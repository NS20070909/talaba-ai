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
    const headerText = `🧠 <b>TALABA AI — QUIZ TEST</b>\n\n📌 <b>Mavzu:</b> ${title}\n📊 <b>Savollar soni:</b> ${questions.length} ta\n⏱ <b>Vaqt:</b> ${
      config?.timerSeconds ? `${config.timerSeconds} sek/savol` : "Cheklovsiz"
    }\n\n👇 <i>Omad yor bo'lsin! Savollarga javob bering:</i>`;

    const headerMsg = await bot.telegram.sendMessage(targetChatId, headerText, {
      parse_mode: "HTML",
    });
    if (headerMsg?.message_id) {
      sentMessageIds.push(headerMsg.message_id);
    }

    // Determine if channel or requested anonymous
    const isChannel = typeof targetChatId === "string" && targetChatId.startsWith("@");
    const forceAnonymous = options?.isAnonymous ?? isChannel;

    // 2. Send each question as a native Telegram Quiz Poll
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      // Format Question text
      let rawQText = `${i + 1}. ${q.text}`.trim();
      if (rawQText.length > 300) {
        rawQText = rawQText.substring(0, 297) + "...";
      }

      // Format Options
      const optionsText = q.options.map((o) => {
        let txt = o.text.trim();
        if (txt.length > 100) txt = txt.substring(0, 97) + "...";
        return txt || "Variant";
      });

      // Ensure between 2 and 10 options
      if (optionsText.length < 2) {
        optionsText.push("Boshqa variant");
      }
      const safeOptions = optionsText.slice(0, 10);

      // Find correct option index
      let correctIndex = q.options.findIndex((o) => o.isCorrect);
      if (correctIndex < 0 || correctIndex >= safeOptions.length) {
        correctIndex = 0; // Default to first option if unspecified
      }

      // Format Explanation
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

        // Small delay to avoid Telegram rate limits
        await new Promise((r) => setTimeout(r, 250));
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
