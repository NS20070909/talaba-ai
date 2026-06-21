import { NextResponse } from "next/server";
import { getUser } from "@/lib/storage";
import { getOrResetUsage } from "@/lib/limit-checker";
import { PLAN_LIMITS } from "@/lib/limits";
import { PlanType } from "@/lib/user";
import { checkAndExpirePremium } from "@/lib/admin";

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

    // 2. Auto-expire premium if past deadline
    if (user && user.plan !== "FREE") {
      await checkAndExpirePremium(telegramId);
    }

    // 3. Re-fetch user after potential expiry
    const freshUser = user && user.plan !== "FREE" ? await getUser(telegramId) : user;
    const plan: PlanType = freshUser ? freshUser.plan : "FREE";

    // 4. Get current daily usage stats (handling day-based resets)
    const stats = await getOrResetUsage(telegramId);

    // 5. Get plan limits
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
