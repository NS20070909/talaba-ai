import { bot } from "../bot";
import { QuizQuestion, QuizConfig } from "./types";

export interface QueueJob {
  id: string;
  userId: number;
  targetChatId: number | string;
  title: string;
  questions: QuizQuestion[];
  config?: QuizConfig;
  isAnonymous?: boolean;
  cancelled?: boolean;
}

// Per-user and per-chat lock map to prevent overlapping poll broadcasts
const activeJobs = new Map<string, QueueJob>();

export function cancelQuizQueue(userId: number, chatId?: number | string): boolean {
  let cancelledCount = 0;
  activeJobs.forEach((job, key) => {
    if (job.userId === userId || (chatId && String(job.targetChatId) === String(chatId))) {
      job.cancelled = true;
      cancelledCount++;
    }
  });
  return cancelledCount > 0;
}

export function isQueueActive(userId: number): boolean {
  for (const job of activeJobs.values()) {
    if (job.userId === userId && !job.cancelled) return true;
  }
  return false;
}

export async function processQuizQueue(
  userId: number,
  targetChatId: number | string,
  title: string,
  questions: QuizQuestion[],
  config?: QuizConfig,
  options?: { isAnonymous?: boolean }
): Promise<{ success: boolean; sentCount: number; messageIds: number[]; error?: string }> {
  const jobId = `job_${userId}_${Date.now()}`;
  const jobKey = `${userId}_${targetChatId}`;

  // If previous job is still running for this user/chat, cancel it to prevent interleaving
  const existing = activeJobs.get(jobKey);
  if (existing) {
    existing.cancelled = true;
  }

  const job: QueueJob = {
    id: jobId,
    userId,
    targetChatId,
    title,
    questions,
    config,
    isAnonymous: options?.isAnonymous,
    cancelled: false,
  };

  activeJobs.set(jobKey, job);

  const sentMessageIds: number[] = [];
  const forceAnonymous = options?.isAnonymous ?? (typeof targetChatId === "string" && targetChatId.startsWith("@"));
  const batchSize = config?.splitBatchSize && config.splitBatchSize > 0 ? config.splitBatchSize : 0;
  let currentBatchIndex = 0;

  try {
    for (let i = 0; i < questions.length; i++) {
      if (job.cancelled) {
        console.log(`[QuizQueue] Job ${jobId} was cancelled at question ${i + 1}/${questions.length}`);
        activeJobs.delete(jobKey);
        return {
          success: false,
          sentCount: sentMessageIds.length,
          messageIds: sentMessageIds,
          error: "🛑 Yuborish bekor qilindi",
        };
      }

      // Batch divider message
      if (batchSize > 0 && i % batchSize === 0) {
        currentBatchIndex++;
        const totalBatches = Math.ceil(questions.length / batchSize);
        const batchEnd = Math.min(questions.length, currentBatchIndex * batchSize);
        const batchStart = (currentBatchIndex - 1) * batchSize + 1;

        const dividerText = `📦 <b>Set ${currentBatchIndex}/${totalBatches}</b> (${batchStart}–${batchEnd}-savollar)`;
        try {
          const divMsg = await bot.telegram.sendMessage(targetChatId, dividerText, { parse_mode: "HTML" });
          if (divMsg?.message_id) sentMessageIds.push(divMsg.message_id);
        } catch (err: any) {
          console.warn("[QuizQueue] Divider message send failed:", err?.message);
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

      if (optionsText.length < 2) optionsText.push("Boshqa variant");
      const safeOptions = optionsText.slice(0, 10);

      let correctIndex = q.options.findIndex((o) => o.isCorrect);
      if (correctIndex < 0 || correctIndex >= safeOptions.length) correctIndex = 0;

      let explanation = q.explanation ? q.explanation.trim() : undefined;
      if (explanation && explanation.length > 200) {
        explanation = explanation.substring(0, 197) + "...";
      }

      let retryCount = 0;
      let sentSuccess = false;

      while (retryCount < 3 && !sentSuccess && !job.cancelled) {
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
          sentSuccess = true;
        } catch (pollErr: any) {
          retryCount++;
          const errMsg = String(pollErr?.message || pollErr);

          // Handle Telegram Flood Wait 429
          if (errMsg.includes("429") || errMsg.includes("Too Many Requests") || pollErr?.code === 429) {
            const retryAfter = pollErr?.parameters?.retry_after || 3;
            console.warn(`[QuizQueue] ⚠️ Telegram Flood Wait (429)! Waiting ${retryAfter} seconds...`);
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
          } else {
            console.error(`[QuizQueue] Retry ${retryCount}/3 failed for question ${i + 1}:`, errMsg);
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }

      // Safe rate-limit delay between polls (250ms)
      await new Promise((r) => setTimeout(r, 250));
    }

    activeJobs.delete(jobKey);
    return {
      success: true,
      sentCount: questions.length,
      messageIds: sentMessageIds,
    };
  } catch (err: any) {
    activeJobs.delete(jobKey);
    console.error("[QuizQueue] Queue execution error:", err);
    return {
      success: false,
      sentCount: sentMessageIds.length,
      messageIds: sentMessageIds,
      error: err?.message || "Telegram-ga test yuborishda xatolik yuz berdi",
    };
  }
}
