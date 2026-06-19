import { NextResponse } from "next/server";
import { getUser } from "@/lib/storage";
import { getOrResetUsage } from "@/lib/limit-checker";
import { PLAN_LIMITS } from "@/lib/limits";
import { PlanType } from "@/lib/user";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramIdParam = searchParams.get("telegram_id");

    if (!telegramIdParam) {
      return NextResponse.json(
        { success: false, error: "MISSING_TELEGRAM_ID", message: "telegram_id parameter is required." },
        { status: 400 }
      );
    }

    const telegramId = Number(telegramIdParam);
    if (isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_TELEGRAM_ID", message: "telegram_id must be a valid number." },
        { status: 400 }
      );
    }

    // 1. Get user to check plan type
    const user = await getUser(telegramId);
    const plan: PlanType = user ? user.plan : "FREE";

    // 2. Get current daily usage stats (handling day-based resets)
    const stats = await getOrResetUsage(telegramId);

    // 3. Get plan limits
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
