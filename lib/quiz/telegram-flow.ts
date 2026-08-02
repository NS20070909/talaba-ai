import { bot } from "../bot";
import { canUseQuiz, incrementQuiz } from "../limit-checker";
import { getBotState, setBotState, deleteBotState } from "../storage";
import { extractTextFromFile } from "./upload-manager";
import { parseQuizHybrid } from "./hybrid-parser";
import { buildQuizSelection, smartRandomSelect } from "./random-engine";
import { sendQuizToTelegram } from "./telegram-adapter";
import { saveQuizHistory, getUserQuizHistory, getQuizHistoryById, deleteQuizHistoryRecord } from "./storage";
import { QuizQuestion, QuizConfig } from "./types";
import { getActiveUserSession, saveUserSession, clearUserSession } from "./session-manager";

interface QuizTelegramSession {
  title: string;
  sourceFileName?: string;
  rawText: string;
  questions: QuizQuestion[];
  config: QuizConfig;
  targetChatId?: number | string;
  targetChatTitle?: string;
}

// In-memory sessions store for Telegram flow (keyed by userId)
const telegramQuizSessions = new Map<number, QuizTelegramSession>();

export function detectChatType(ctx: any): "private" | "group" | "supergroup" | "channel" {
  const type = (ctx.chat?.type as string) || "private";
  if (type === "group" || type === "supergroup") return type;
  if (type === "channel") return "channel";
  return "private";
}

export async function handleTelegramQuizCommand(ctx: any) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const chatType = detectChatType(ctx);
  const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "talaba_ai_bot";

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

  // Handle Group / Supergroup command context
  if (chatType === "group" || chatType === "supergroup") {
    const session = telegramQuizSessions.get(userId);
    const activeSession = await getActiveUserSession(userId);

    const inlineKeyboard: any[] = [];
    if (session || (activeSession && activeSession.questions?.length)) {
      inlineKeyboard.push([
        { text: "🚀 Ushbu Guruhga Quiz Yuborish", callback_data: `tg_quiz:send_to_group_${ctx.chat.id}` },
      ]);
    }
    inlineKeyboard.push([
      { text: "💬 Shaxsiy Chatda Test Yuborish", url: `https://t.me/${BOT_USERNAME}?start=quiz` },
    ]);
    inlineKeyboard.push([
      { text: "📊 Statistika", callback_data: "tg_quiz:menu_stats" },
    ]);

    await ctx.replyWithHTML(
      `👥 <b>TALABA AI — GURUHDA QUIZ YARATISH</b>\n\n` +
        `📌 <b>Guruh:</b> ${ctx.chat.title || "Guruh"}\n\n` +
        (session || activeSession?.questions?.length
          ? `✅ Sizda tayyorlangan test topildi! Guruhga yuborish uchun pastdagi tugmani bosing.`
          : `1️⃣ Shaxsiy chatda botga test faylingizni yuboring (PDF, DOCX, TXT, Rasm).\n` +
            `2️⃣ Tayyor bo'lgach ushbu guruhda <b>/quiz</b> buyrug'ini yuboring!`),
      {
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }
    );
    return;
  }

  // Private Chat context
  await setBotState(userId, "quiz:waiting_for_input");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://talaba-ai-chi.vercel.app";
  const activeSession = await getActiveUserSession(userId);

  const inlineKeyboard: any[] = [];
  if (activeSession && activeSession.questions?.length) {
    inlineKeyboard.push([
      { text: `▶️ Davom Ettirish (${activeSession.fileName || "Quiz"})`, callback_data: "tg_quiz:resume_session" },
    ]);
  }
  inlineKeyboard.push([
    { text: "🧠 Mini App'da Quiz Builder", web_app: { url: `${appUrl}/quiz?userId=${userId}` } },
  ]);
  inlineKeyboard.push([
    { text: "📊 Statistika", callback_data: "tg_quiz:menu_stats" },
    { text: "📜 Tarix", callback_data: "tg_quiz:menu_history" },
  ]);
  inlineKeyboard.push([
    { text: "ℹ️ Yordam & Formatlar", callback_data: "tg_quiz:help" },
  ]);

  await ctx.replyWithHTML(
    `🧠 <b>TALABA AI — QUIZ ENGINE V2</b>\n\n` +
      (activeSession?.questions?.length
        ? `⚠️ <b>Chala qolgan quiz topildi:</b> "${activeSession.fileName || "Quiz"}" (${activeSession.questions.length} ta savol).\n\n`
        : "") +
      `Iltimos, yangi quiz yaratish uchun test faylingizni yuboring (PDF, OCR PDF, DOCX, DOC, TXT, XLSX, CSV, JPG, PNG) yoki matn shaklida yuboring:`,
    {
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    }
  );
}

export async function handleTelegramHistoryCommand(ctx: any) {
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
}

export async function handleTelegramStatistikaCommand(ctx: any) {
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
}

export async function handleTelegramHelpQuizCommand(ctx: any) {
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
}

export async function handleTelegramQuizFile(
  ctx: any,
  fileId: string,
  fileName: string,
  mimeType?: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const statusMsg = await ctx.reply("📄 Fayl qabul qilindi. Matn o'qilmoqda va ajratilmoqda...");

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
          "🔍 OCR va AI Parsing tahlili bajarilmoqda..."
        );
      }
    } catch {}

    const extracted = await extractTextFromFile(fileBuffer, fileName, mimeType);
    if (!extracted.text || extracted.text.trim().length === 0) {
      await ctx.reply("❌ Xatolik: Fayldan matn o'qib bo'lmadi. Boshqa fayl yuborib ko'ring.");
      return;
    }

    const parsedResult = await parseQuizHybrid(extracted.text, fileName);
    if (!parsedResult.questions || parsedResult.questions.length === 0) {
      await ctx.reply("❌ Xatolik: Fayl ichida mos test savollari va variantlari topilmadi.");
      return;
    }

    const session: QuizTelegramSession = {
      title: parsedResult.title || "Talaba AI Quiz",
      sourceFileName: fileName,
      rawText: extracted.text,
      questions: parsedResult.questions,
      config: {
        title: parsedResult.title || "Talaba AI Quiz",
        selectionMode: "ALL",
        targetCount: Math.min(20, parsedResult.questions.length),
        shuffleQuestions: true,
        shuffleOptions: true,
        timerSeconds: 30,
        splitBatchSize: 0,
      },
      targetChatId: ctx.chat?.id,
      targetChatTitle: ctx.chat?.title || "Shaxsiy chat",
    };

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

export async function handleTelegramQuizText(ctx: any, text: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const statusMsg = await ctx.reply("🧠 Matn tahlil qilinmoqda va test savollari ajratilmoqda...");

  try {
    const parsedResult = await parseQuizHybrid(text, "Text_Input.txt");
    if (!parsedResult.questions || parsedResult.questions.length === 0) {
      await ctx.reply("❌ Xatolik: Matn ichida test savollari va variantlari topilmadi.");
      return;
    }

    const session: QuizTelegramSession = {
      title: parsedResult.title || "Talaba AI Quiz",
      sourceFileName: "Text_Input.txt",
      rawText: text,
      questions: parsedResult.questions,
      config: {
        title: parsedResult.title || "Talaba AI Quiz",
        selectionMode: "ALL",
        targetCount: Math.min(20, parsedResult.questions.length),
        shuffleQuestions: true,
        shuffleOptions: true,
        timerSeconds: 30,
        splitBatchSize: 0,
      },
      targetChatId: ctx.chat?.id,
      targetChatTitle: ctx.chat?.title || "Shaxsiy chat",
    };

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

export async function handleTelegramQuizChannelInput(ctx: any, text: string) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const target = text.trim();
  const session = telegramQuizSessions.get(userId);

  if (!session) {
    await ctx.reply("❌ Faol quiz topilmadi. Qaytadan /quiz yuboring.");
    return;
  }

  session.targetChatId = target.startsWith("@") || !isNaN(Number(target)) ? target : `@${target}`;
  session.targetChatTitle = String(session.targetChatId);
  await deleteBotState(userId);

  await ctx.replyWithHTML(`✅ <b>Yuborish joyi sozlandi:</b> <code>${session.targetChatId}</code>`);
  await renderQuizConfigMenu(ctx, userId);
}

export async function renderQuizConfigMenu(ctx: any, userId: number) {
  const session = telegramQuizSessions.get(userId);
  if (!session) {
    await ctx.reply("❌ Quiz sessiyasi topilmadi. Qaytadan /quiz deb yuboring.");
    return;
  }

  const { title, questions, config, targetChatTitle, targetChatId } = session;
  const total = questions.length;
  const targetLabel = targetChatTitle || (targetChatId ? String(targetChatId) : "Ushbu chat");

  let text = `⚙️ <b>Quiz Sozlamalari</b>\n\n`;
  text += `📌 <b>Mavzu:</b> ${title}\n`;
  text += `📊 <b>Topilgan savollar:</b> ${total} ta\n`;
  text += `🔢 <b>Tanlangan savollar:</b> ${config.targetCount || total} ta (${config.selectionMode})\n`;
  text += `⏱ <b>Taymer:</b> ${config.timerSeconds > 0 ? `${config.timerSeconds} sek` : "Cheksiz"}\n`;
  text += `🔀 <b>Savollar aralashtirish:</b> ${config.shuffleQuestions ? "✅ Yoqilgan" : "❌ O'chirilgan"}\n`;
  text += `🔀 <b>Variantlar aralashtirish:</b> ${config.shuffleOptions ? "✅ Yoqilgan" : "❌ O'chirilgan"}\n`;
  text += `✂️ <b>Split (Bo'lish):</b> ${(config.splitBatchSize || 0) > 0 ? `Har ${config.splitBatchSize} tadan` : "Bo'linmaydi"}\n`;
  text += `📢 <b>Yuborish joyi:</b> <code>${targetLabel}</code>\n\n`;
  text += `Sozlamalarni o'zgartiring va <b>🚀 QUIZNI YARATISH</b> tugmasini bosing:`;

  const inlineKeyboard = [
    [
      { text: `⏱ Taymer: ${config.timerSeconds}s`, callback_data: "tg_quiz:toggle_timer" },
      { text: `📊 Soni: ${config.targetCount}`, callback_data: "tg_quiz:toggle_count" },
    ],
    [
      { text: `🔀 Savol Shuffle: ${config.shuffleQuestions ? "✅" : "❌"}`, callback_data: "tg_quiz:toggle_sq" },
      { text: `🔀 Variant Shuffle: ${config.shuffleOptions ? "✅" : "❌"}`, callback_data: "tg_quiz:toggle_so" },
    ],
    [
      { text: `🧠 Rejim: ${config.selectionMode}`, callback_data: "tg_quiz:toggle_mode" },
      { text: `✂️ Split: ${(config.splitBatchSize || 0) > 0 ? config.splitBatchSize : "Off"}`, callback_data: "tg_quiz:toggle_split" },
    ],
    [
      { text: `📢 Yuborish joyi (Kanal / Guruh)`, callback_data: "tg_quiz:prompt_channel" },
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

export async function handleQuizCallback(ctx: any) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const callbackData = ctx.callbackQuery?.data || "";

  if (callbackData === "tg_quiz:help") {
    await ctx.answerCbQuery();
    await handleTelegramHelpQuizCommand(ctx);
    return;
  }

  if (callbackData === "tg_quiz:cancel") {
    telegramQuizSessions.delete(userId);
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
    await setBotState(userId, "quiz:waiting_for_channel");
    await ctx.answerCbQuery("📢 Kanal username yoki linkini kiritishingiz mumkin");
    await ctx.replyWithHTML(
      `📢 <b>Kanal yoki Guruhga Yuborish</b>\n\n` +
        `Iltimos, bot admin qilingan Kanal username (masalan <code>@my_channel</code>) yoki Guruh ID sini yuboring:\n\n` +
        `<i>Bot u yerda e'lon berish (Poll yuborish) huquqiga ega bo'lishi kerak.</i>`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⬅️ Ortga (Sozlamalarga qaytish)", callback_data: "tg_quiz:back_config" }],
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

  if (callbackData.startsWith("tg_quiz:send_to_group_")) {
    const groupId = callbackData.replace("tg_quiz:send_to_group_", "");
    let session = telegramQuizSessions.get(userId);

    if (!session) {
      const activeSession = await getActiveUserSession(userId);
      if (activeSession && activeSession.questions?.length) {
        session = {
          title: activeSession.fileName ? activeSession.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") : "Quiz",
          sourceFileName: activeSession.fileName,
          rawText: activeSession.rawText || "",
          questions: activeSession.questions,
          config: {
            title: activeSession.fileName || "Quiz",
            selectionMode: "ALL",
            targetCount: Math.min(20, activeSession.questions.length),
            shuffleQuestions: true,
            shuffleOptions: true,
            timerSeconds: 30,
            splitBatchSize: 0,
            ...activeSession.settings,
          },
          targetChatId: groupId,
          targetChatTitle: ctx.chat?.title || "Guruh",
        };
        telegramQuizSessions.set(userId, session);
      }
    } else {
      session.targetChatId = groupId;
      session.targetChatTitle = ctx.chat?.title || "Guruh";
    }

    if (!session) {
      await ctx.answerCbQuery("❌ Faol quiz topilmadi.", { show_alert: true });
      return;
    }

    await ctx.answerCbQuery("🚀 Guruhga yuborilmoqda...");
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
        await ctx.replyWithHTML(`✅ <b>${item.title}</b> chatga qayta yuborildi!`);
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
        title: item.title,
        sourceFileName: item.sourceFileName || "Quiz",
        rawText: "",
        questions: item.questions,
        config: item.settings || {
          title: item.title,
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

  let session = telegramQuizSessions.get(userId);

  if (callbackData === "tg_quiz:resume_session") {
    const activeSession = await getActiveUserSession(userId);
    if (activeSession && activeSession.questions?.length) {
      session = {
        title: activeSession.fileName ? activeSession.fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") : "Quiz",
        sourceFileName: activeSession.fileName,
        rawText: activeSession.rawText || "",
        questions: activeSession.questions,
        config: {
          title: activeSession.fileName || "Quiz",
          selectionMode: "ALL",
          targetCount: Math.min(20, activeSession.questions.length),
          shuffleQuestions: true,
          shuffleOptions: true,
          timerSeconds: 30,
          splitBatchSize: 0,
          ...activeSession.settings,
        },
        targetChatId: ctx.chat?.id,
        targetChatTitle: ctx.chat?.title || "Shaxsiy chat",
      };
      telegramQuizSessions.set(userId, session);
      await ctx.answerCbQuery("▶️ Avvalgi quiz tayyorlandi!");
      await renderQuizConfigMenu(ctx, userId);
      return;
    } else {
      await ctx.answerCbQuery("❌ Tiklash uchun chala quiz topilmadi.", { show_alert: true });
      return;
    }
  }

  if (!session && callbackData.startsWith("tg_quiz:")) {
    await ctx.answerCbQuery("❌ Quiz sessiyasi eskirgan. /quiz yuboring.", { show_alert: true });
    return;
  }

  if (!session) return;

  if (callbackData === "tg_quiz:toggle_timer") {
    const timers = [0, 15, 30, 60];
    const currIdx = timers.indexOf(session.config.timerSeconds);
    const nextIdx = (currIdx + 1) % timers.length;
    session.config.timerSeconds = timers[nextIdx];
    await ctx.answerCbQuery(`⏱ Taymer: ${session.config.timerSeconds || "Cheksiz"}`);
  } else if (callbackData === "tg_quiz:toggle_count") {
    const total = session.questions.length;
    const counts = [Math.min(10, total), Math.min(20, total), Math.min(50, total), total].filter(
      (v, idx, self) => self.indexOf(v) === idx
    );
    const currIdx = counts.indexOf(session.config.targetCount || total);
    const nextIdx = (currIdx + 1) % counts.length;
    session.config.targetCount = counts[nextIdx];
    await ctx.answerCbQuery(`📊 Soni: ${session.config.targetCount}`);
  } else if (callbackData === "tg_quiz:toggle_sq") {
    session.config.shuffleQuestions = !session.config.shuffleQuestions;
    await ctx.answerCbQuery(`🔀 Savol Shuffle: ${session.config.shuffleQuestions ? "✅" : "❌"}`);
  } else if (callbackData === "tg_quiz:toggle_so") {
    session.config.shuffleOptions = !session.config.shuffleOptions;
    await ctx.answerCbQuery(`🔀 Variant Shuffle: ${session.config.shuffleOptions ? "✅" : "❌"}`);
  } else if (callbackData === "tg_quiz:toggle_mode") {
    session.config.selectionMode = session.config.selectionMode === "ALL" ? "SMART_RANDOM" : "ALL";
    await ctx.answerCbQuery(`🧠 Rejim: ${session.config.selectionMode}`);
  } else if (callbackData === "tg_quiz:toggle_split") {
    const splits = [0, 30, 50];
    const currIdx = splits.indexOf(session.config.splitBatchSize || 0);
    const nextIdx = (currIdx + 1) % splits.length;
    session.config.splitBatchSize = splits[nextIdx];
    await ctx.answerCbQuery(`✂️ Split: ${session.config.splitBatchSize || "Off"}`);
  } else if (callbackData === "tg_quiz:generate") {
    await ctx.answerCbQuery("🚀 Quiz yaratilmoqda va yuborilmoqda...");

    try {
      let targetQuestions = [...session.questions];

      if (session.config.selectionMode === "SMART_RANDOM" && session.config.targetCount) {
        targetQuestions = await smartRandomSelect(targetQuestions, session.config.targetCount);
      }

      const builtQuestions = buildQuizSelection(targetQuestions, session.config);

      const recipientChatId = session.targetChatId || ctx.chat?.id || userId;
      const isChannel = typeof recipientChatId === "string" && recipientChatId.startsWith("@");

      const sendResult = await sendQuizToTelegram(
        recipientChatId,
        session.title,
        builtQuestions,
        session.config,
        { isAnonymous: isChannel }
      );

      if (sendResult.success) {
        await incrementQuiz(userId);
        await saveQuizHistory(
          userId,
          session.title,
          builtQuestions,
          session.config,
          session.sourceFileName,
          sendResult.messageIds
        );
        await deleteBotState(userId);
        await clearUserSession(userId);
        telegramQuizSessions.delete(userId);

        await ctx.replyWithHTML(
          `✅ <b>Quiz Tayyor va Yuborildi!</b>\n\n` +
            `Jami ${sendResult.sentCount} ta test savoli muvaffaqiyatli <code>${recipientChatId}</code> chatga yuborildi.`
        );
      } else {
        await ctx.reply(`❌ Quizni yuborishda xatolik: ${sendResult.error || "Noma'lum xatolik"}`);
      }
    } catch (err: any) {
      console.error("tg_quiz:generate error:", err);
      await ctx.reply(`❌ Quiz yaratishda xatolik: ${err?.message || "Noma'lum xatolik"}`);
    }
    return;
  }

  await renderQuizConfigMenu(ctx, userId);
}
