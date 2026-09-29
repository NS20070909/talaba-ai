import { NextResponse } from "next/server";
import { guardCheck } from "@/lib/limit-checker";
import { PLAN_LIMITS } from "@/lib/limits";
import { PlanType } from "@/lib/user";
import { getVerifiedTelegramUser } from "@/lib/telegram-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramIdParam = searchParams.get("telegram_id");

    const auth = await getVerifiedTelegramUser(req, { telegram_user_id: telegramIdParam });
    let telegramId = auth.telegramId || (telegramIdParam ? Number(telegramIdParam) : undefined);

    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "MISSING_TELEGRAM_ID", message: "telegram_id parameter is required." },
        { status: 400 }
      );
    }

    // Consolidated single-pass guard check (ban, premium expiry, daily reset)
    const guard = await guardCheck(telegramId);
    if (guard.blocked && guard.result?.banned) {
      return NextResponse.json(
        { success: false, error: "BANNED", message: "🚫 Siz bloklangansiz" },
        { status: 403 }
      );
    }

    const plan: PlanType = guard.user ? guard.user.plan : "FREE";
    const stats = guard.stats;
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

    return NextResponse.json({
      success: true,
      stats: {
        plan,
        isUnlimited: !!limits.unlimited,
        pptUsed: stats.pptUsedToday,
        pptLimit: limits.pptPerDay ?? 0,
        pdfUsed: stats.pdfUsedToday,
        pdfLimit: limits.pdfPerDay ?? 0,
        scanUsed: stats.scanUsedToday,
        scanLimit: limits.scanPerDay ?? 0,
        referatUsed: stats.referatUsedToday,
        referatLimit: limits.referatPerDay ?? 0,
        translationUsed: stats.translationUsedToday,
        translationLimit: limits.translationPerDay ?? 2,
        liveMinutesLimit: limits.liveMinutesPerDay ?? 20,
        liveSecondsUsed: stats.liveSecondsToday ?? 0,
        liveSecondsRemaining: Math.max(0, (limits.liveMinutesPerDay ?? 20) * 60 - (stats.liveSecondsToday ?? 0)),
        flashReviewLimit: limits.unlimited ? 999 : (limits.flashReviewPerDay ?? 5),
        flashReviewUsed: stats.flashReviewUsedToday ?? 0,
        quizLimit: limits.unlimited ? 999 : (limits.quizPerDay ?? 5),
        quizUsed: stats.quizUsedToday ?? 0,
        chatUnlimited: true,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/user-stats:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
