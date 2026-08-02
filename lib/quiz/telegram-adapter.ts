import { bot } from "../bot";
import { QuizQuestion, QuizConfig } from "./types";

export interface SendTelegramQuizResult {
  success: boolean;
  sentCount: number;
  messageIds: number[];
  error?: string;
}

export async function sendQuizToTelegram(
  targetChatId: number | string,
  title: string,
  questions: QuizQuestion[],
  config?: QuizConfig,
  options?: { isAnonymous?: boolean }
): Promise<SendTelegramQuizResult> {
  const sentMessageIds: number[] = [];

  try {
    // 1. Send Quiz Header intro message
    const headerText =
      `🧠 <b>TALABA AI — QUIZ TEST</b>\n\n` +
      `📌 <b>Mavzu:</b> ${title}\n` +
      `📊 <b>Savollar soni:</b> ${questions.length} ta\n` +
      `⏱ <b>Vaqt:</b> ${config?.timerSeconds ? `${config.timerSeconds} sek/savol` : "Cheklovsiz"}\n` +
      (config?.splitBatchSize && config.splitBatchSize > 0
        ? `✂️ <b>Bo'linish:</b> Har ${config.splitBatchSize} tadan to'plam\n`
        : "") +
      `\n👇 <i>Omad yor bo'lsin! Savollarga javob bering:</i>`;

    const headerMsg = await bot.telegram.sendMessage(targetChatId, headerText, {
      parse_mode: "HTML",
    });
    if (headerMsg?.message_id) {
      sentMessageIds.push(headerMsg.message_id);
    }

    const isChannel = typeof targetChatId === "string" && targetChatId.startsWith("@");
    const forceAnonymous = options?.isAnonymous ?? isChannel;

    const batchSize = config?.splitBatchSize && config.splitBatchSize > 0 ? config.splitBatchSize : 0;
    let currentBatchIndex = 0;

    // 2. Send each question as a native Telegram Quiz Poll
    for (let i = 0; i < questions.length; i++) {
      // If batching is enabled, send batch divider headers
      if (batchSize > 0 && i % batchSize === 0) {
        currentBatchIndex++;
        const totalBatches = Math.ceil(questions.length / batchSize);
        const batchEnd = Math.min(questions.length, (currentBatchIndex) * batchSize);
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

      // Format Question text
      let rawQText = `📄 Test ${i + 1}/${questions.length}\n\n${q.text}`.trim();
      if (rawQText.length > 300) {
        rawQText = rawQText.substring(0, 297) + "...";
      }

      // Format Options
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
