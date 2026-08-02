import { NextResponse } from "next/server";
import {
  getUserGamificationStats,
  getQuizLeaderboard,
  getWrongAnswersForRetry,
  markWrongAnswerResolved,
  recordQuizResult,
} from "@/lib/quiz/gamification";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = Number(searchParams.get("telegram_id"));
    const userName = searchParams.get("user_name") || undefined;
    const mode = searchParams.get("mode") || "all";

    if (mode === "leaderboard") {
      const leaderboard = await getQuizLeaderboard(50);
      return NextResponse.json({ success: true, leaderboard });
    }

    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ success: false, error: "telegram_id required" }, { status: 400 });
    }

    const userStats = await getUserGamificationStats(telegramId, userName);
    const leaderboard = await getQuizLeaderboard(10);

    let wrongAnswers: any[] = [];
    if (mode === "wrong_answers" || mode === "all") {
      wrongAnswers = await getWrongAnswersForRetry(telegramId);
    }

    return NextResponse.json({
      success: true,
      stats: userStats,
      leaderboard,
      wrongAnswers,
    });
  } catch (error: any) {
    console.error("Quiz Gamification GET error:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, telegram_id, user_name, total_questions, correct_answers, wrong_questions, wrong_id } = body;

    const userId = Number(telegram_id);
    if (!userId || isNaN(userId)) {
      return NextResponse.json({ success: false, error: "telegram_id required" }, { status: 400 });
    }

    if (action === "resolve_wrong") {
      if (!wrong_id) {
        return NextResponse.json({ success: false, error: "wrong_id required" }, { status: 400 });
      }
      const success = await markWrongAnswerResolved(wrong_id, userId);
      return NextResponse.json({ success });
    }

    if (action === "record_result") {
      const result = await recordQuizResult(
        userId,
        user_name || `User #${userId}`,
        Number(total_questions || 0),
        Number(correct_answers || 0),
        wrong_questions || []
      );
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Quiz Gamification POST error:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
