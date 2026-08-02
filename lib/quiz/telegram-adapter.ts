import { bot } from "../bot";
import { QuizQuestion, QuizConfig } from "./types";

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

export const preparedQuizStore = new Map<string, PreparedQuiz>();

export function storePreparedQuiz(
  targetChatId: number | string,
  title: string,
  questions: QuizQuestion[],
  config?: QuizConfig
): string {
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

    const cardText =
      `🧠 <b>TALABA AI TEST</b>\n\n` +
      `📌 <b>Mavzu:</b>\n${title}\n\n` +
      `📊 <b>Savollar:</b>\n${questions.length} ta\n\n` +
      `⏱ <b>Vaqt:</b>\n${config?.timerSeconds ? `${config.timerSeconds} sek/savol` : "Cheklovsiz"}\n\n` +
      `🔀 <b>Rejim:</b>\n${config?.selectionMode || "Standard"}\n` +
      (config?.splitBatchSize && config.splitBatchSize > 0
        ? `\n✂️ <b>Bo'linish:</b>\nHar ${config.splitBatchSize} tadan to'plam\n`
        : "") +
      `\n━━━━━━━━━━━━━━━\n` +
      `👇 <i>Testni boshlash uchun quyidagi tugmani bosing:</i>`;

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
    console.error("sendQuizCardToTelegram error:", err);
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
  const sentMessageIds: number[] = [];

  try {
    const isChannel = typeof targetChatId === "string" && targetChatId.startsWith("@");
    const forceAnonymous = options?.isAnonymous ?? isChannel;

    const batchSize = config?.splitBatchSize && config.splitBatchSize > 0 ? config.splitBatchSize : 0;
    let currentBatchIndex = 0;

    // Send each question as a native Telegram Quiz Poll
    for (let i = 0; i < questions.length; i++) {
      // If batching is enabled, send batch divider headers
      if (batchSize > 0 && i % batchSize === 0) {
        currentBatchIndex++;
        const totalBatches = Math.ceil(questions.length / batchSize);
        const batchEnd = Math.min(questions.length, currentBatchIndex * batchSize);
        const batchStart = (currentBatchIndex - 1) * batchSize + 1;

        const dividerText = `📦 <b>Set ${currentBatchIndex}/${totalBatches}</b> (${batchStart}–${batchEnd}-savollar)`;
        const divMsg = await bot.telegram.sendMessage(targetChatId, dividerText, {
          parse_mode: "HTML",
        });
        if (divMsg?.message_id) {
          sentMessageIds.push(divMsg.message_id);
        }
      }

      const q = questions[i];

      let rawQText = `📄 Test ${i + 1}/${questions.length}\n\n${q.text}`.trim();
      if (rawQText.length > 300) {
        rawQText = rawQText.substring(0, 297) + "...";
      }

      const optionsText = q.options.map((o) => {
        let txt = o.text.trim();
        if (txt.length > 100) txt = txt.substring(0, 97) + "...";
        return txt || "Variant";
      });

      if (optionsText.length < 2) {
        optionsText.push("Boshqa variant");
      }
      const safeOptions = optionsText.slice(0, 10);

      let correctIndex = q.options.findIndex((o) => o.isCorrect);
      if (correctIndex < 0 || correctIndex >= safeOptions.length) {
        correctIndex = 0;
      }

      let explanation = q.explanation ? q.explanation.trim() : undefined;
      if (explanation && explanation.length > 200) {
        explanation = explanation.substring(0, 197) + "...";
      }

      try {
        const pollMsg = await bot.telegram.sendPoll(
          targetChatId,
          rawQText,
          safeOptions,
          {
            type: "quiz",
            correct_option_id: correctIndex,
            explanation,
            open_period: config?.timerSeconds && config.timerSeconds >= 5 ? config.timerSeconds : undefined,
            is_anonymous: forceAnonymous,
          } as any
        );

        if (pollMsg?.message_id) {
          sentMessageIds.push(pollMsg.message_id);
        }

        await new Promise((r) => setTimeout(r, 200));
      } catch (pollErr) {
        console.error(`Failed to send Telegram poll for question ${i + 1}:`, pollErr);
      }
    }

    return {
      success: true,
      sentCount: questions.length,
      messageIds: sentMessageIds,
    };
  } catch (err: any) {
    console.error("sendQuizToTelegram error:", err);
    return {
      success: false,
      sentCount: 0,
      messageIds: sentMessageIds,
      error: err?.message || "Telegram-ga quiz yuborishda xatolik yuz berdi",
    };
  }
}
