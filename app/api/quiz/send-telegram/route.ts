import { NextResponse } from "next/server";
import { QuizQuestion, QuizConfig } from "@/lib/quiz/types";
import { sendQuizToTelegram, sendQuizCardToTelegram, sendQuizCollectionCardToTelegram } from "@/lib/quiz/telegram-adapter";
import { buildQuizCollection } from "@/lib/quiz/random-engine";
import { saveQuizHistory } from "@/lib/quiz/storage";
import { canUseQuiz, incrementQuiz } from "@/lib/limit-checker";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { telegram_id, title, questions, config, sourceFileName } = (await req.json()) as {
      telegram_id: number;
      title: string;
      questions: QuizQuestion[];
      config?: QuizConfig;
      sourceFileName?: string;
    };

    const telegramId = Number(telegram_id);
    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ success: false, error: "telegram_id topilmadi" }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, error: "Savollar topilmadi" }, { status: 400 });
    }

    const limitCheck = await canUseQuiz(telegramId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "LIMIT_REACHED",
          message: "Sizning kunlik Quiz yuborish limiti tugagan. Premium rejaga o'ting!",
        },
        { status: 403 }
      );
    }

    if (config?.builderMode === "MULTI") {
      const collection = buildQuizCollection(questions, config);
      const colResult = await sendQuizCollectionCardToTelegram(
        telegramId,
        collection,
        config
      );

      if (!colResult.success) {
        return NextResponse.json(
          { success: false, error: colResult.error || "Telegram-ga collection card yuborishda xatolik" },
          { status: 500 }
        );
      }

      await incrementQuiz(telegramId);
      const historyRecord = await saveQuizHistory(
        telegramId,
        title || collection.title || "TALABA AI Quiz Collection",
        questions,
        config,
        sourceFileName,
        colResult.messageId ? [colResult.messageId] : []
      );

      return NextResponse.json({
        success: true,
        sentCount: questions.length,
        batchCount: collection.testSets.length,
        historyId: historyRecord?.id,
        message: `✅ Telegram-ga ${collection.testSets.length} ta testdan iborat Test To'plami Karta yuborildi!`,
      });
    }

    const sendResult = await sendQuizCardToTelegram(
      telegramId,
      title || "TALABA AI Quiz",
      questions,
      config
    );

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, error: sendResult.error || "Telegram-ga card yuborishda xatolik" },
        { status: 500 }
      );
    }

    // Increment usage in limit checker
    await incrementQuiz(telegramId);

    // Save to history in DB
    const historyRecord = await saveQuizHistory(
      telegramId,
      title || "TALABA AI Quiz",
      questions,
      config || { selectionMode: "ALL", shuffleQuestions: false, shuffleOptions: false, timerSeconds: 0 },
      sourceFileName,
      sendResult.messageId ? [sendResult.messageId] : []
    );

    return NextResponse.json({
      success: true,
      sentCount: questions.length,
      historyId: historyRecord?.id,
      message: `✅ Telegram-ga ${questions.length} ta savoldan iborat Test Karta yuborildi!`,
    });
  } catch (error: any) {
    console.error("Quiz send-telegram API error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Telegram-ga quiz yuborishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
