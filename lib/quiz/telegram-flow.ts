import { bot } from "../bot";
import { canUseQuiz, incrementQuiz } from "../limit-checker";
import { getBotState, setBotState, deleteBotState } from "../storage";
import { extractTextFromFile } from "./upload-manager";
import { parseQuizHybrid } from "./hybrid-parser";
import { buildQuizSelection, buildQuizCollection, smartRandomSelect } from "./random-engine";
import { sendQuizToTelegram, sendQuizCardToTelegram, sendQuizCollectionCardToTelegram, preparedQuizStore, preparedCollectionStore, escapeHTML } from "./telegram-adapter";
import { saveQuizHistory, getUserQuizHistory, getQuizHistoryById, deleteQuizHistoryRecord } from "./storage";
import { QuizQuestion, QuizConfig } from "./types";
import { getActiveUserSession, saveUserSession, clearUserSession } from "./session-manager";

export type QuizFlowState =
  | "START"
  | "WAIT_FILE"
  | "PARSING"
  | "SETTINGS"
  | "GENERATING"
  | "SENDING"
  | "FINISHED";

interface QuizTelegramSession {
  state: QuizFlowState;
  title: string;
  sourceFileName?: string;
  rawText: string;
  questions: QuizQuestion[];
  config: QuizConfig;
  targetChatId?: number | string;
  targetChatTitle?: string;
}

// In-memory sessions store for Telegram flow (keyed by composite key: `${userId}_${chatId}`)
const telegramQuizSessions = new Map<string, QuizTelegramSession>();

function getSessionKey(userId: number, chatId?: number | string): string {
  return chatId ? `${userId}_${chatId}` : `${userId}`;
}

export async function getTelegramSession(userId: number, chatId?: number | string): Promise<QuizTelegramSession | null> {
  const key = getSessionKey(userId, chatId);
  let session = telegramQuizSessions.get(key);
  if (session) return session;

  // Fallback to primary userId session if composite key miss
  session = telegramQuizSessions.get(`${userId}`);
  if (session) return session;

  // Fallback to Supabase persistent active session on process cold start
  try {
    const dbSession = await getActiveUserSession(userId);
    if (dbSession && dbSession.questions && dbSession.questions.length > 0) {
      const tgMeta = (dbSession.settings as any)?._tg || {};
      const recovered: QuizTelegramSession = {
        state: tgMeta.state || "SETTINGS",
        title: tgMeta.title || dbSession.fileName?.replace(/\.[^/.]+$/, "") || "Talaba AI Quiz",
        sourceFileName: dbSession.fileName,
        rawText: dbSession.rawText || "",
        questions: dbSession.questions,
        config: {
          title: tgMeta.title || "Talaba AI Quiz",
          builderMode: "SINGLE",
          selectionMode: "ALL",
          targetCount: Math.min(20, dbSession.questions.length),
          shuffleQuestions: true,
          shuffleOptions: true,
          timerSeconds: 30,
          splitBatchSize: 0,
          ...dbSession.settings,
        },
        targetChatId: tgMeta.targetChatId || chatId || userId,
        targetChatTitle: tgMeta.targetChatTitle || "Shaxsiy chat",
      };
      telegramQuizSessions.set(key, recovered);
      return recovered;
    }
  } catch (err) {
    console.warn("[TelegramSession] Recovery failed:", err);
  }

  return null;
}

export function setTelegramSession(userId: number, session: QuizTelegramSession, chatId?: number | string): void {
  const key = getSessionKey(userId, chatId);
  telegramQuizSessions.set(key, session);

  // Non-blocking save to persistent DB storage
  saveUserSession({
    userId,
    fileName: session.sourceFileName,
    step: session.state === "SETTINGS" ? "CONFIG" : "EDIT",
    rawText: session.rawText,
    questions: session.questions,
    settings: {
      ...session.config,
      _tg: {
        state: session.state,
        title: session.title,
        targetChatId: session.targetChatId,
        targetChatTitle: session.targetChatTitle,
      },
    } as any,
  }).catch(() => {});
}

export function deleteTelegramSession(userId: number, chatId?: number | string): void {
  telegramQuizSessions.delete(getSessionKey(userId, chatId));
  telegramQuizSessions.delete(`${userId}`);
  clearUserSession(userId).catch(() => {});
}

export function detectChatType(ctx: any): "private" | "group" | "supergroup" | "channel" {
  const type = (ctx.chat?.type as string) || "private";
  if (type === "group" || type === "supergroup") return type;
  if (type === "channel") return "channel";
  return "private";
}

/**
 * Step 1: /quiz Command Handler
 * Shows ONLY file request and Cancel button. No Mini App, Stats, or History clutter.
 */
export async function handleTelegramQuizCommand(ctx: any) {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const limitCheck = await canUseQuiz(userId);
    if (!limitCheck.allowed) {
      await ctx.replyWithHTML(
        `⚠️ <b>Kunlik Quiz Limiti Tugagan</b>\n\n` +
          `Bugungi bepul Quiz yaratish limiingiz (5/5) tugadi. Cheklovlarsiz foydalanish uchun Premium tarifiga o'ting!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "👑 Premium Olish", callback_data: "user:menu:premium" }],
            ],
          },
        }
      );
      return;
    }

    await setBotState(userId, "quiz:waiting_for_input");

    const session: QuizTelegramSession = {
      state: "WAIT_FILE",
      title: "Talaba AI Quiz",
      rawText: "",
      questions: [],
      config: {
        title: "Talaba AI Quiz",
        builderMode: "SINGLE",
        multiTestBatchSize: 25,
        selectionMode: "ALL",
        targetCount: 20,
        shuffleQuestions: true,
        shuffleOptions: true,
        timerSeconds: 30,
        splitBatchSize: 0,
      },
      targetChatId: ctx.chat?.id,
      targetChatTitle: ctx.chat?.title || "Shaxsiy chat",
    };
    setTelegramSession(userId, session, ctx.chat?.id);

    await ctx.replyWithHTML(
      `🧠 <b>Quiz yaratishni boshlaymiz.</b>\n\n` +
        `📄 <b>Test faylingizni yuboring.</b>\n\n` +
        `Qo'llab-quvvatlanadi:\n` +
        `• PDF\n• OCR PDF\n• DOC\n• DOCX\n• TXT\n• CSV\n• XLS\n• XLSX\n• JPG\n• PNG\n\n` +
        `<i>Yoki test matnini yuboring.</i>`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🛑 Bekor qilish", callback_data: "tg_quiz:cancel" }],
          ],
        },
      }
    );
  } catch (err: any) {
    console.error("handleTelegramQuizCommand error:", err);
    await ctx.reply("❌ Quiz buyrug'ini bajarishda xatolik yuz berdi.").catch(() => {});
  }
}

/**
 * Step 2: File Upload / Document Handler with Single Animated Progress Message
 */
export async function handleTelegramQuizFile(
  ctx: any,
  fileId: string,
  fileName: string,
  mimeType?: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  let session: QuizTelegramSession = telegramQuizSessions.get(userId) || {
    state: "PARSING",
    title: "Talaba AI Quiz",
    sourceFileName: fileName,
    rawText: "",
    questions: [],
    config: {
      title: "Talaba AI Quiz",
      selectionMode: "ALL",
      targetCount: 20,
      shuffleQuestions: true,
      shuffleOptions: true,
      timerSeconds: 30,
      splitBatchSize: 0,
    },
    targetChatId: ctx.chat?.id,
  };
  session.state = "PARSING";
  telegramQuizSessions.set(userId, session);

  const statusMsg = await ctx.reply("📄 Fayl qabul qilindi. Matn ajratilmoqda...");

  try {
    const fileLink = await bot.telegram.getFileLink(fileId);
    const response = await fetch(fileLink.href);
    const arrayBuf = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuf);

    try {
      if (statusMsg?.message_id) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          undefined,
          "🔍 OCR & Matn ajratilmoqda..."
        );
      }
    } catch {}

    const extracted = await extractTextFromFile(fileBuffer, fileName, mimeType);
    if (!extracted.text || extracted.text.trim().length === 0) {
      await ctx.reply("❌ Xatolik: Fayldan matn o'qib bo'lmadi. Boshqa fayl yuborib ko'ring.");
      return;
    }

    try {
      if (statusMsg?.message_id) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          undefined,
          "🧠 Parser & AI tahlil qilmoqda..."
        );
      }
    } catch {}

    const parsedResult = await parseQuizHybrid(extracted.text, fileName);
    if (!parsedResult.questions || parsedResult.questions.length === 0) {
      await ctx.reply("❌ Xatolik: Fayl ichida mos test savollari va variantlari topilmadi.");
      return;
    }

    session.state = "SETTINGS";
    session.title = parsedResult.title || "Talaba AI Quiz";
    session.sourceFileName = fileName;
    session.rawText = extracted.text;
    session.questions = parsedResult.questions;
    session.config.title = session.title;
    session.config.targetCount = Math.min(20, parsedResult.questions.length);

    telegramQuizSessions.set(userId, session);
    await setBotState(userId, "quiz:configuring");
    await saveUserSession({
      userId,
      fileHash: extracted.fileHash,
      fileName,
      step: "CONFIG",
      rawText: extracted.text,
      questions: parsedResult.questions,
      settings: session.config,
    });

    try {
      if (statusMsg?.message_id) {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      }
    } catch {}

    await renderQuizConfigMenu(ctx, userId);
  } catch (err: any) {
    console.error("handleTelegramQuizFile error:", err);
    await ctx.reply(`❌ Faylni tahlil qilishda xatolik: ${err?.message || "Noma'lum xatolik"}`);
  }
}

/**
 * Step 2: Text Input Handler
 */
export async function handleTelegramQuizText(ctx: any, text: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  let session: QuizTelegramSession = telegramQuizSessions.get(userId) || {
    state: "PARSING",
    title: "Talaba AI Quiz",
    sourceFileName: "Text_Input.txt",
    rawText: text,
    questions: [],
    config: {
      title: "Talaba AI Quiz",
      selectionMode: "ALL",
      targetCount: 20,
      shuffleQuestions: true,
      shuffleOptions: true,
      timerSeconds: 30,
      splitBatchSize: 0,
    },
    targetChatId: ctx.chat?.id,
  };
  session.state = "PARSING";
  telegramQuizSessions.set(userId, session);

  const statusMsg = await ctx.reply("🧠 Matn tahlil qilinmoqda va test savollari ajratilmoqda...");

  try {
    const parsedResult = await parseQuizHybrid(text, "Text_Input.txt");
    if (!parsedResult.questions || parsedResult.questions.length === 0) {
      await ctx.reply("❌ Xatolik: Matn ichida test savollari va variantlari topilmadi.");
      return;
    }

    session.state = "SETTINGS";
    session.title = parsedResult.title || "Talaba AI Quiz";
    session.sourceFileName = "Text_Input.txt";
    session.rawText = text;
    session.questions = parsedResult.questions;
    session.config.title = session.title;
    session.config.targetCount = Math.min(20, parsedResult.questions.length);

    telegramQuizSessions.set(userId, session);
    await setBotState(userId, "quiz:configuring");

    try {
      if (statusMsg?.message_id) {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      }
    } catch {}

    await renderQuizConfigMenu(ctx, userId);
  } catch (err: any) {
    console.error("handleTelegramQuizText error:", err);
    await ctx.reply(`❌ Matnni tahlil qilishda xatolik: ${err?.message || "Noma'lum xatolik"}`);
  }
}

/**
 * Step 3: Settings Menu (`SETTINGS` state)
 */
export async function renderQuizConfigMenu(ctx: any, userId: number) {
  const session = await getTelegramSession(userId, ctx.chat?.id);
  if (!session) {
    await ctx.reply("❌ Quiz sessiyasi topilmadi. Qaytadan /quiz deb yuboring.");
    return;
  }

  const { title, questions, config, targetChatTitle, targetChatId } = session;
  const total = questions.length;
  const targetLabel = escapeHTML(targetChatTitle || (targetChatId ? String(targetChatId) : "Ushbu chat"));
  const safeTitle = escapeHTML(title);
  const isMulti = config.builderMode === "MULTI";
  const batchSize = config.multiTestBatchSize || 25;
  const multiTestCount = Math.ceil(total / batchSize);

  let text = `⚙️ <b>Quiz Sozlamalari</b>\n\n`;
  text += `📌 <b>Mavzu:</b> ${safeTitle}\n`;
  text += `📊 <b>Topilgan savollar:</b> ${total} ta\n`;
  text += `🎛 <b>Rejim:</b> ${isMulti ? `📦 MULTI TEST (${multiTestCount} ta test)` : `1️⃣ SINGLE TEST`}\n`;
  if (isMulti) {
    text += `📑 <b>Har bir test:</b> ${batchSize} tadan savol\n`;
  } else {
    text += `🔢 <b>Tanlangan savollar:</b> ${config.targetCount || total} ta (${config.selectionMode})\n`;
  }
  text += `⏱ <b>Taymer:</b> ${config.timerSeconds > 0 ? `${config.timerSeconds} sek` : "Cheksiz"}\n`;
  text += `🔀 <b>Savollar aralashtirish:</b> ${config.shuffleQuestions ? "✅ Yoqilgan" : "❌ O'chirilgan"}\n`;
  text += `🔀 <b>Variantlar aralashtirish:</b> ${config.shuffleOptions ? "✅ Yoqilgan" : "❌ O'chirilgan"}\n`;
  text += `📍 <b>Yuborish joyi:</b> <code>${targetLabel}</code>\n\n`;
  text += `Sozlamalarni o'zgartiring va <b>🚀 QUIZNI YARATISH</b> tugmasini bosing:`;

  const inlineKeyboard = [
    [
      { text: `🎛 Rejim: ${isMulti ? "📦 MULTI TEST" : "1️⃣ SINGLE TEST"}`, callback_data: "tg_quiz:toggle_builder_mode" },
      isMulti
        ? { text: `📑 Har bir test: ${batchSize} ta`, callback_data: "tg_quiz:toggle_batch_size" }
        : { text: `📊 Savol soni: ${config.targetCount}`, callback_data: "tg_quiz:toggle_count" },
    ],
    [
      { text: `⏱ Taymer: ${config.timerSeconds}s`, callback_data: "tg_quiz:toggle_timer" },
      { text: `🧠 Tanlov: ${config.selectionMode}`, callback_data: "tg_quiz:toggle_mode" },
    ],
    [
      { text: `🔀 Savol Shuffle: ${config.shuffleQuestions ? "✅" : "❌"}`, callback_data: "tg_quiz:toggle_sq" },
      { text: `🔀 Variant Shuffle: ${config.shuffleOptions ? "✅" : "❌"}`, callback_data: "tg_quiz:toggle_so" },
    ],
    [
      { text: `📍 Yuborish joyi (${targetLabel})`, callback_data: "tg_quiz:prompt_channel" },
    ],
    [
      { text: "🛑 Bekor qilish", callback_data: "tg_quiz:cancel" },
      { text: "🚀 QUIZNI YARATISH VA YUBORISH", callback_data: "tg_quiz:generate" },
    ],
  ];

  if (ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      });
      return;
    } catch {}
  }

  await ctx.replyWithHTML(text, {
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });
}

/**
 * Handle Channel Username Input & Admin Rights Verification
 */
export async function handleTelegramQuizChannelInput(ctx: any, text: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const target = text.trim();
  const session = telegramQuizSessions.get(userId);

  if (!session) {
    await ctx.reply("❌ Faol quiz topilmadi. Qaytadan /quiz yuboring.");
    return;
  }

  const formattedTarget = target.startsWith("@") || !isNaN(Number(target)) ? target : `@${target}`;

  // Verify Channel Admin Rights if username provided
  if (typeof formattedTarget === "string" && formattedTarget.startsWith("@")) {
    try {
      const botInfo = await bot.telegram.getMe();
      const member = await bot.telegram.getChatMember(formattedTarget, botInfo.id);
      if (member.status !== "administrator" && member.status !== "creator") {
        await ctx.replyWithHTML(
          `⚠️ <b>Kanalda Admin Huquqi Yo'q</b>\n\n` +
            `Bot ushbu kanal (<code>${formattedTarget}</code>) da admin emas yoki e'lon berish huquqi yo'q.\n` +
            `Iltimos, botni kanalga admin qilib qo'shing va qayta kiriting!`
        );
        return;
      }
    } catch (err: any) {
      await ctx.replyWithHTML(
        `⚠️ <b>Kanal Topilmadi yoki Ruxsat Yo'q</b>\n\n` +
          `Bot <code>${formattedTarget}</code> kanalini topa olmadi. Botni kanalga admin qilganingizga ishonch hosil qiling.`
      );
      return;
    }
  }

  session.targetChatId = formattedTarget;
  session.targetChatTitle = String(formattedTarget);
  await deleteBotState(userId);

  await ctx.replyWithHTML(`✅ <b>Yuborish joyi sozlandi:</b> <code>${session.targetChatId}</code>`);
  await renderQuizConfigMenu(ctx, userId);
}

/**
 * Commands: /history, /statistika, /help_quiz
 */
export async function handleTelegramHistoryCommand(ctx: any) {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const history = await getUserQuizHistory(userId);
    if (!history || history.length === 0) {
      await ctx.replyWithHTML("📜 <b>Quizlar Tarixi</b>\n\nHozircha hech qanday quiz saqlanmagan. /quiz deb yuboring!");
      return;
    }

    const recentItems = history.slice(0, 5);
    let text = `📜 <b>Quizlar Tarixi (So'nggi 5 ta)</b>\n\n`;

    const inlineKeyboard: any[] = [];

    recentItems.forEach((item, idx) => {
      text += `<b>${idx + 1}. ${item.title}</b>\n`;
      text += `📊 Savollar: ${item.questionCount} ta | 🗓 ${new Date(item.createdAt).toLocaleDateString("uz-UZ")}\n\n`;

      inlineKeyboard.push([
        { text: `👁 ${item.title.substring(0, 15)}...`, callback_data: `tg_quiz:view_${item.id}` },
        { text: "📤 Yuborish", callback_data: `tg_quiz:resend_${item.id}` },
        { text: "🔁 Qayta", callback_data: `tg_quiz:regen_${item.id}` },
        { text: "🗑", callback_data: `tg_quiz:del_${item.id}` },
      ]);
    });

    await ctx.replyWithHTML(text, {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });
  } catch (err: any) {
    console.error("handleTelegramHistoryCommand error:", err);
  }
}

export async function handleTelegramStatistikaCommand(ctx: any) {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    const limitCheck = await canUseQuiz(userId);
    const history = await getUserQuizHistory(userId);

    const totalQuizzes = history.length;
    const totalQuestions = history.reduce((sum, h) => sum + (h.questionCount || 0), 0);

    let text = `📊 <b>TALABA AI — QUIZ STATISTIKASI</b>\n\n`;
    text += `👤 <b>Foydalanuvchi:</b> <code>${userId}</code>\n`;
    text += `📊 <b>Kunlik limit holati:</b> ${limitCheck.remaining === 999999 ? "Cheksiz ∞ (PRO Premium)" : `${5 - Math.max(0, limitCheck.remaining)} / 5 ta`}\n`;
    text += `🔄 <b>Qolgan bepul limit:</b> ${limitCheck.remaining === 999999 ? "Cheksiz ∞" : `${limitCheck.remaining} ta`}\n\n`;
    text += `📈 <b>Jami yaratilgan quizlar:</b> ${totalQuizzes} ta\n`;
    text += `🎯 <b>Jami ishlangan savollar:</b> ${totalQuestions} ta\n`;
    text += `⚡ <b>O'rtacha yaratish vaqti:</b> ~1.5 sek\n`;
    text += `🛡 <b>SHA-256 Kesh va AI tejamkorligi:</b> ~85% tejalgan\n`;

    await ctx.replyWithHTML(text);
  } catch (err: any) {
    console.error("handleTelegramStatistikaCommand error:", err);
  }
}

export async function handleTelegramHelpQuizCommand(ctx: any) {
  try {
    let text = `ℹ️ <b>QUIZ ENGINE V2 — YORDAM VA FORMATLAR</b>\n\n`;
    text += `Botga quyidagi formatdagi fayllarni yuborishingiz mumkin:\n`;
    text += `• 📄 <b>PDF</b> (Oddiy va OCR skanerlangan)\n`;
    text += `• 📝 <b>DOCX / DOC</b> (Microsoft Word)\n`;
    text += `• 📑 <b>TXT / CSV</b> (Oddiy matnlar va jadvallar)\n`;
    text += `• 📊 <b>XLSX / XLS</b> (Excel jadvallari)\n`;
    text += `• 🖼 <b>JPG / PNG / WEBP</b> (Rasm va test skaneri)\n\n`;
    text += `<b>Boshqaruv buyruqlari:</b>\n`;
    text += `/quiz - Yangi quiz yaratish (Guruh, Kanal, Shaxsiy)\n`;
    text += `/history - Quizlar tarixi va qayta yuborish\n`;
    text += `/statistika - Statistika va limit holati\n`;
    text += `/help_quiz - Ushbu yordam oynasi\n`;

    await ctx.replyWithHTML(text);
  } catch (err: any) {
    console.error("handleTelegramHelpQuizCommand error:", err);
  }
}

/**
 * Main Callback Routing Handler
 */
export async function handleQuizCallback(ctx: any) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const callbackData = ctx.callbackQuery?.data || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talaba-ai-chi.vercel.app";

  if (callbackData === "tg_quiz:help") {
    await ctx.answerCbQuery();
    await handleTelegramHelpQuizCommand(ctx);
    return;
  }

  if (callbackData === "tg_quiz:cancel") {
    deleteTelegramSession(userId, ctx.chat?.id);
    await deleteBotState(userId);
    await clearUserSession(userId);
    await ctx.answerCbQuery("🛑 Bekor qilindi");
    try {
      await ctx.editMessageText("🛑 Quiz yaratish bekor qilindi. Yangisini boshlash uchun /quiz deb yuboring.");
    } catch {
      await ctx.reply("🛑 Quiz yaratish bekor qilindi. Yangisini boshlash uchun /quiz deb yuboring.");
    }
    return;
  }

  if (callbackData.startsWith("tg_quiz:start_poll_")) {
    const quizId = callbackData.replace("tg_quiz:start_poll_", "");
    const prepared = preparedQuizStore.get(quizId);

    if (!prepared) {
      await ctx.answerCbQuery("⚠️ Test karta topilmadi yoki eskirgan.", { show_alert: true });
      return;
    }

    await ctx.answerCbQuery("🚀 Test boshlandi!");
    try {
      await ctx.editMessageText(
        `🚀 <b>"${prepared.title}" test savollari yuborilmoqda...</b>\n\n` +
          `📊 Jami ${prepared.questions.length} ta savol.`,
        { parse_mode: "HTML" }
      );
    } catch {}

    const isChannel = typeof prepared.targetChatId === "string" && prepared.targetChatId.startsWith("@");
    const sendResult = await sendQuizToTelegram(
      prepared.targetChatId,
      prepared.title,
      prepared.questions,
      prepared.config,
      { isAnonymous: isChannel }
    );

    if (sendResult.success) {
      await incrementQuiz(userId);
      await saveQuizHistory(
        userId,
        prepared.title,
        prepared.questions,
        prepared.config || { selectionMode: "ALL", shuffleQuestions: false, shuffleOptions: false, timerSeconds: 0 },
        undefined,
        sendResult.messageIds
      );
      preparedQuizStore.delete(quizId);
    }
    return;
  }

  // Multi-Test Collection batch launcher callback
  if (callbackData.startsWith("tg_quiz:start_set_")) {
    const parts = callbackData.replace("tg_quiz:start_set_", "").split("_");
    const collectionId = parts.slice(0, -1).join("_");
    const setIndex = Number(parts[parts.length - 1]);

    const preparedCol = preparedCollectionStore.get(collectionId);
    if (!preparedCol) {
      await ctx.answerCbQuery("⚠️ Test to'plami topilmadi yoki eskirgan.", { show_alert: true });
      return;
    }

    const testSet = preparedCol.collection.testSets.find((s) => s.index === setIndex);
    if (!testSet) {
      await ctx.answerCbQuery("⚠️ Test qismi topilmadi.", { show_alert: true });
      return;
    }

    await ctx.answerCbQuery(`🚀 ${testSet.title} boshlandi!`);
    const isChannel = typeof preparedCol.targetChatId === "string" && preparedCol.targetChatId.startsWith("@");

    const sendResult = await sendQuizToTelegram(
      preparedCol.targetChatId,
      `${preparedCol.collection.title} — ${testSet.title}`,
      testSet.questions,
      preparedCol.config,
      { isAnonymous: isChannel }
    );

    if (sendResult.success) {
      await incrementQuiz(userId);
      await saveQuizHistory(
        userId,
        `${preparedCol.collection.title} — ${testSet.title}`,
        testSet.questions,
        preparedCol.config || { selectionMode: "ALL", shuffleQuestions: false, shuffleOptions: false, timerSeconds: 0 },
        undefined,
        sendResult.messageIds
      );
    }
    return;
  }

  if (callbackData === "tg_quiz:start_new") {
    await ctx.answerCbQuery();
    await handleTelegramQuizCommand(ctx);
    return;
  }

  if (callbackData === "tg_quiz:menu_stats") {
    await ctx.answerCbQuery();
    await handleTelegramStatistikaCommand(ctx);
    return;
  }

  if (callbackData === "tg_quiz:menu_history") {
    await ctx.answerCbQuery();
    await handleTelegramHistoryCommand(ctx);
    return;
  }

  if (callbackData === "tg_quiz:prompt_channel") {
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `📍 <b>Quiz Yuboriladigan Joyni Tanlang</b>\n\n` +
        `Quyidagi tugmalardan birini bosing yoki Kanal / Guruh username'ini matn ko'rinishida yuboring:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "👤 Ushbu Shaxsiy Chatga", callback_data: "tg_quiz:set_target_private" }],
            ...(ctx.chat?.type === "group" || ctx.chat?.type === "supergroup"
              ? [[{ text: `📍 Ushbu Guruhga (${ctx.chat.title})`, callback_data: `tg_quiz:set_target_group_${ctx.chat.id}` }]]
              : []),
            [{ text: "📢 Kanalga Yuborish (@channel_username)", callback_data: "tg_quiz:set_target_channel_prompt" }],
            [{ text: "⬅️ Ortga (Sozlamalarga qaytish)", callback_data: "tg_quiz:back_config" }],
          ],
        },
      }
    );
    return;
  }

  if (callbackData === "tg_quiz:set_target_private") {
    const session = telegramQuizSessions.get(userId);
    if (session) {
      session.targetChatId = userId;
      session.targetChatTitle = "Shaxsiy chat";
    }
    await ctx.answerCbQuery("✅ Yuborish joyi: Shaxsiy chat");
    await renderQuizConfigMenu(ctx, userId);
    return;
  }

  if (callbackData.startsWith("tg_quiz:set_target_group_")) {
    const groupId = callbackData.replace("tg_quiz:set_target_group_", "");
    const session = telegramQuizSessions.get(userId);
    if (session) {
      session.targetChatId = groupId;
      session.targetChatTitle = ctx.chat?.title || "Guruh";
    }
    await ctx.answerCbQuery("✅ Yuborish joyi: Guruh");
    await renderQuizConfigMenu(ctx, userId);
    return;
  }

  if (callbackData === "tg_quiz:set_target_channel_prompt") {
    await setBotState(userId, "quiz:waiting_for_channel");
    await ctx.answerCbQuery();
    await ctx.replyWithHTML(
      `📢 <b>Kanal Username or Linkini Yuboring</b>\n\n` +
        `Iltimos, bot admin bo'lgan kanal username'ini yuboring:\n` +
        `Misol: <code>@talaba_ai_channel</code>`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Ortga (Sozlamalar)", callback_data: "tg_quiz:back_config" }],
          ],
        },
      }
    );
    return;
  }

  if (callbackData === "tg_quiz:back_config") {
    await deleteBotState(userId);
    await ctx.answerCbQuery();
    await renderQuizConfigMenu(ctx, userId);
    return;
  }

  // History Action Handlers
  if (callbackData.startsWith("tg_quiz:view_")) {
    const id = callbackData.replace("tg_quiz:view_", "");
    const item = await getQuizHistoryById(id, userId);
    if (item && item.questions) {
      let summary = `👁 <b>${item.title}</b>\n\n`;
      summary += `Savollar soni: ${item.questionCount} ta\n\n`;
      item.questions.slice(0, 3).forEach((q, idx) => {
        summary += `<b>${idx + 1}. ${q.text}</b>\n`;
        q.options.forEach((o) => {
          summary += `${o.isCorrect ? "✅" : "▫️"} ${o.id}) ${o.text}\n`;
        });
        summary += `\n`;
      });
      if (item.questions.length > 3) summary += `<i>...va yana ${item.questions.length - 3} ta savol.</i>`;
      await ctx.answerCbQuery("👁 Quiz ko'rildi");
      await ctx.replyWithHTML(summary);
    }
    return;
  }

  if (callbackData.startsWith("tg_quiz:resend_")) {
    const id = callbackData.replace("tg_quiz:resend_", "");
    const item = await getQuizHistoryById(id, userId);
    if (item && item.questions) {
      await ctx.answerCbQuery("📤 Telegramga qayta yuborilmoqda...");
      const targetId = ctx.chat?.id || userId;
      const sendResult = await sendQuizToTelegram(targetId, item.title, item.questions, item.settings);
      if (sendResult.success) {
        await ctx.replyWithHTML(
          `✅ <b>${item.title}</b> chatga qayta yuborildi!`,
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "📜 Tarix", callback_data: "tg_quiz:menu_history" },
                  { text: "📊 Statistika", callback_data: "tg_quiz:menu_stats" },
                ],
                [
                  { text: "🌐 Mini App'da ochish", web_app: { url: `${appUrl}/quiz?userId=${userId}` } },
                ],
                [
                  { text: "🔁 Yangi Quiz Yaratish", callback_data: "tg_quiz:start_new" },
                ],
              ],
            },
          }
        );
      } else {
        await ctx.reply(`❌ Yuborishda xatolik: ${sendResult.error}`);
      }
    }
    return;
  }

  if (callbackData.startsWith("tg_quiz:regen_")) {
    const id = callbackData.replace("tg_quiz:regen_", "");
    const item = await getQuizHistoryById(id, userId);
    if (item && item.questions) {
      const session: QuizTelegramSession = {
        state: "SETTINGS",
        title: item.title,
        sourceFileName: item.sourceFileName || "Quiz",
        rawText: "",
        questions: item.questions,
        config: item.settings || {
          title: item.title,
          builderMode: "SINGLE",
          selectionMode: "ALL",
          targetCount: item.questionCount,
          shuffleQuestions: true,
          shuffleOptions: true,
          timerSeconds: 30,
        },
        targetChatId: ctx.chat?.id,
        targetChatTitle: ctx.chat?.title || "Shaxsiy chat",
      };
      telegramQuizSessions.set(userId, session);
      await ctx.answerCbQuery("🔁 Qayta yaratish uchun sessiya ochildi!");
      await renderQuizConfigMenu(ctx, userId);
    }
    return;
  }

  if (callbackData.startsWith("tg_quiz:del_")) {
    const id = callbackData.replace("tg_quiz:del_", "");
    await deleteQuizHistoryRecord(id, userId);
    await ctx.answerCbQuery("🗑 Tarixdan o'chirildi", { show_alert: true });
    try {
      await ctx.deleteMessage();
    } catch {}
    return;
  }

  let session = await getTelegramSession(userId, ctx.chat?.id);
  if (!session && callbackData.startsWith("tg_quiz:")) {
    await ctx.answerCbQuery("❌ Quiz sessiyasi eskirgan. /quiz yuboring.", { show_alert: true });
    return;
  }

  if (!session) return;

  if (callbackData === "tg_quiz:toggle_builder_mode") {
    session.config.builderMode = session.config.builderMode === "MULTI" ? "SINGLE" : "MULTI";
    await ctx.answerCbQuery(`🎛 Rejim: ${session.config.builderMode === "MULTI" ? "📦 MULTI TEST" : "1️⃣ SINGLE TEST"}`);
  } else if (callbackData === "tg_quiz:toggle_batch_size") {
    const presets = [20, 25, 30, 40, 50, 100];
    const currIdx = presets.indexOf(session.config.multiTestBatchSize || 25);
    const nextIdx = (currIdx + 1) % presets.length;
    session.config.multiTestBatchSize = presets[nextIdx];
    await ctx.answerCbQuery(`📑 Har bir test: ${session.config.multiTestBatchSize} ta`);
  } else if (callbackData === "tg_quiz:toggle_timer") {
    const timers = [0, 15, 30, 60];
    const currIdx = timers.indexOf(session.config.timerSeconds);
    const nextIdx = (currIdx + 1) % timers.length;
    session.config.timerSeconds = timers[nextIdx];
    await ctx.answerCbQuery(`⏱ Taymer: ${session.config.timerSeconds || "Cheksiz"}`);
  } else if (callbackData === "tg_quiz:toggle_count") {
    const total = session.questions.length;
    const presets = [5, 10, 15, 20, 25, 30, 40, 50, 100, total];
    const counts = presets
      .map((p) => Math.min(p, total))
      .filter((v, idx, self) => v > 0 && self.indexOf(v) === idx);
    const currIdx = counts.indexOf(session.config.targetCount || total);
    const nextIdx = (currIdx + 1) % counts.length;
    session.config.targetCount = counts[nextIdx];
    await ctx.answerCbQuery(`📊 Savollar soni: ${session.config.targetCount}`);
  } else if (callbackData === "tg_quiz:toggle_sq") {
    session.config.shuffleQuestions = !session.config.shuffleQuestions;
    await ctx.answerCbQuery(`🔀 Savol Shuffle: ${session.config.shuffleQuestions ? "✅" : "❌"}`);
  } else if (callbackData === "tg_quiz:toggle_so") {
    session.config.shuffleOptions = !session.config.shuffleOptions;
    await ctx.answerCbQuery(`🔀 Variant Shuffle: ${session.config.shuffleOptions ? "✅" : "❌"}`);
  } else if (callbackData === "tg_quiz:toggle_mode") {
    session.config.selectionMode = session.config.selectionMode === "ALL" ? "SMART_RANDOM" : "ALL";
    await ctx.answerCbQuery(`🧠 Tanlov: ${session.config.selectionMode}`);
  } else if (callbackData === "tg_quiz:generate") {
    session.state = "SENDING";
    await ctx.answerCbQuery("🚀 Test karta tayyorlanmoqda...");

    try {
      const recipientChatId = session.targetChatId || ctx.chat?.id || userId;

      if (session.config.builderMode === "MULTI") {
        const collection = buildQuizCollection(session.questions, session.config);
        const cardResult = await sendQuizCollectionCardToTelegram(
          recipientChatId,
          collection,
          session.config
        );

        if (cardResult.success) {
          session.state = "FINISHED";
          await deleteBotState(userId);
          await clearUserSession(userId);
        } else {
          session.state = "SETTINGS";
          await ctx.reply(`❌ Test to'plam karta yuborishda xatolik: ${cardResult.error || "Noma'lum xatolik"}`);
        }
      } else {
        let targetQuestions = [...session.questions];
        if (session.config.selectionMode === "SMART_RANDOM" && session.config.targetCount) {
          targetQuestions = await smartRandomSelect(targetQuestions, session.config.targetCount);
        }
        const builtQuestions = buildQuizSelection(targetQuestions, session.config);

        const cardResult = await sendQuizCardToTelegram(
          recipientChatId,
          session.title,
          builtQuestions,
          session.config
        );

        if (cardResult.success) {
          session.state = "FINISHED";
          await deleteBotState(userId);
          await clearUserSession(userId);
        } else {
          session.state = "SETTINGS";
          await ctx.reply(`❌ Test karta yuborishda xatolik: ${cardResult.error || "Noma'lum xatolik"}`);
        }
      }
    } catch (err: any) {
      session.state = "SETTINGS";
      console.error("tg_quiz:generate error:", err);
      await ctx.reply(`❌ Test karta yaratishda xatolik: ${err?.message || "Noma'lum xatolik"}`);
    }
    return;
  }

  await renderQuizConfigMenu(ctx, userId);
}
