import { bot } from "../bot";
import { QuizQuestion, QuizConfig, QuizCollection, QuizTestSet } from "./types";
import { processQuizQueue } from "./telegram-queue";
import { sanitizeHTML } from "./security";

export interface SendTelegramQuizResult {
  success: boolean;
  sentCount: number;
  messageIds: number[];
  error?: string;
}

export interface PreparedQuiz {
  id: string;
  targetChatId: number | string;
  title: string;
  questions: QuizQuestion[];
  config?: QuizConfig;
  createdAt: number;
}

export interface PreparedCollection {
  id: string;
  targetChatId: number | string;
  collection: QuizCollection;
  config?: QuizConfig;
  createdAt: number;
}

export const preparedQuizStore = new Map<string, PreparedQuiz>();
export const preparedCollectionStore = new Map<string, PreparedCollection>();

// Auto-cleanup expired prepared quizzes (TTL 2 hours)
function cleanupPreparedStores() {
  const now = Date.now();
  const maxAge = 2 * 60 * 60 * 1000;
  preparedQuizStore.forEach((val, key) => {
    if (now - val.createdAt > maxAge) preparedQuizStore.delete(key);
  });
  preparedCollectionStore.forEach((val, key) => {
    if (now - val.createdAt > maxAge) preparedCollectionStore.delete(key);
  });
}

export function escapeHTML(str: string): string {
  return sanitizeHTML(str);
}

export function storePreparedQuiz(
  targetChatId: number | string,
  title: string,
  questions: QuizQuestion[],
  config?: QuizConfig
): string {
  cleanupPreparedStores();
  const id = `qz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  preparedQuizStore.set(id, {
    id,
    targetChatId,
    title,
    questions,
    config,
    createdAt: Date.now(),
  });
  return id;
}

export function storePreparedCollection(
  targetChatId: number | string,
  collection: QuizCollection,
  config?: QuizConfig
): string {
  cleanupPreparedStores();
  const id = `col_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  preparedCollectionStore.set(id, {
    id,
    targetChatId,
    collection,
    config,
    createdAt: Date.now(),
  });
  return id;
}

/**
 * Sends a Multi-Test Collection Card message to Telegram
 */
export async function sendQuizCollectionCardToTelegram(
  targetChatId: number | string,
  collection: QuizCollection,
  config?: QuizConfig
): Promise<{ success: boolean; collectionId: string; messageId?: number; error?: string }> {
  try {
    const collectionId = storePreparedCollection(targetChatId, collection, config);
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "TalabaAI_Bot";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${botUsername}`)}&text=${encodeURIComponent(`🧠 ${collection.title} test to'plami! (${collection.totalQuestions} ta savol):`)}`;
    const timerLabel = config?.timerSeconds ? `${config.timerSeconds} soniya` : "Cheksiz";
    const safeTitle = escapeHTML(collection.title);

    let cardText =
      `🧠 <b>TARIX TESTLARI</b>\n` +
      `📚 <b>Mavzu</b>\n${safeTitle}\n` +
      `📄 <b>Umumiy savollar</b>\n${collection.totalQuestions}\n` +
      `📦 <b>Testlar</b>\n${collection.testSets.length}\n` +
      `📑 <b>Har biri</b>\n${collection.batchSize}\n` +
      `⏱ <b>${timerLabel}</b>\n` +
      `━━━━━━━━━━━━━━\n`;

    collection.testSets.forEach((set) => {
      cardText += `📦 <b>${escapeHTML(set.title)}</b>\n▶ Boshlash\n`;
    });
    
    cardText += `━━━━━━━━━━━━━━`;

    const inlineKeyboard: any[] = [];
    
    // Add buttons for each test batch
    collection.testSets.forEach((set) => {
      inlineKeyboard.push([
        {
          text: `📦 ${escapeHTML(set.title)} ▶ Boshlash`,
          callback_data: `tg_quiz:start_set_${collectionId}_${set.index}`,
        },
      ]);
    });

    // Add action buttons as exactly requested
    inlineKeyboard.push([
      { text: "👤 Shaxsiy chat", callback_data: "tg_quiz:set_target_private" },
      { text: "👥 Guruhga yuborish", url: shareUrl },
    ]);
    inlineKeyboard.push([
      { text: "📢 Kanalga yuborish", callback_data: "tg_quiz:prompt_channel" },
      { text: "🔗 Ulashish", url: shareUrl },
    ]);
    inlineKeyboard.push([
      { text: "📊 Statistika", callback_data: "tg_quiz:menu_stats" },
      { text: "📜 Tarix", callback_data: "tg_quiz:menu_history" },
    ]);

    console.log(`[Telegram] Sending Collection Card (${collection.testSets.length} sets, ${collection.totalQuestions} Qs) to chat ${targetChatId}`);

    const cardMsg = await bot.telegram.sendMessage(targetChatId, cardText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: inlineKeyboard,
      },
    });

    return {
      success: true,
      collectionId,
      messageId: cardMsg?.message_id,
    };
  } catch (err: any) {
    console.error("[Telegram] sendQuizCollectionCardToTelegram error:", err);
    return {
      success: false,
      collectionId: "",
      error: err?.message || "Test Collection Card yuborishda xatolik",
    };
  }
}

/**
 * Sends a single professional Test Card Message with "▶️ Testni boshlash" button
 * instead of immediately blasting multiple poll messages.
 */
export async function sendQuizCardToTelegram(
  targetChatId: number | string,
  title: string,
  questions: QuizQuestion[],
  config?: QuizConfig
): Promise<{ success: boolean; quizId: string; messageId?: number; error?: string }> {
  try {
    const quizId = storePreparedQuiz(targetChatId, title, questions, config);

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "TalabaAI_Bot";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      `https://t.me/${botUsername}`
    )}&text=${encodeURIComponent(`🧠 ${title} quizi! Sinab ko'ring:`)}`;

    const safeTitle = escapeHTML(title);

    const cardText =
      `🧠 <b>TALABA AI TEST</b>\n\n` +
      `📌 <b>Mavzu:</b> ${safeTitle}\n` +
      `📊 <b>Savollar soni:</b> ${questions.length} ta\n` +
      `⏱ <b>Vaqt:</b> ${config?.timerSeconds ? `${config.timerSeconds} sek/savol` : "Cheklovsiz"}\n` +
      `🔀 <b>Rejim:</b> ${config?.selectionMode || "Standard"}\n` +
      (config?.splitBatchSize && config.splitBatchSize > 0
        ? `✂️ <b>Bo'linish:</b> Har ${config.splitBatchSize} tadan to'plam\n`
        : "") +
      `\n━━━━━━━━━━━━━━━\n` +
      `👇 <i>Testni boshlash uchun quyidagi tugmani bosing:</i>`;

    console.log(`[Telegram] Sending Single Test Card (${questions.length} Qs) to chat ${targetChatId}`);

    const cardMsg = await bot.telegram.sendMessage(targetChatId, cardText, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "▶️ Testni boshlash", callback_data: `tg_quiz:start_poll_${quizId}` }],
          [
            { text: "👥 Guruhda boshlash", url: shareUrl },
            { text: "📤 Testni ulashish", url: shareUrl },
          ],
          [{ text: "📊 Statistikani ko'rish", callback_data: "tg_quiz:menu_stats" }],
        ],
      },
    });

    return {
      success: true,
      quizId,
      messageId: cardMsg?.message_id,
    };
  } catch (err: any) {
    console.error("[Telegram] sendQuizCardToTelegram error:", err);
    return {
      success: false,
      quizId: "",
      error: err?.message || "Test Card yuborishda xatolik",
    };
  }
}

/**
 * Sends actual native Telegram Polls (batching & split supported)
 */
export async function sendQuizToTelegram(
  targetChatId: number | string,
  title: string,
  questions: QuizQuestion[],
  config?: QuizConfig,
  options?: { isAnonymous?: boolean }
): Promise<SendTelegramQuizResult> {
  const userId = typeof targetChatId === "number" ? targetChatId : 0;
  return processQuizQueue(userId, targetChatId, title, questions, config, options);
}
