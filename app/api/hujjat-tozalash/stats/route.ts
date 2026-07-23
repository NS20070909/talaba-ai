export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getHujjatUsageInfo } from "@/lib/hujjat-tozalash/usage";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramIdParam = searchParams.get("telegram_id");

    if (!telegramIdParam) {
      return NextResponse.json(
        { success: false, error: "telegram_id parameter is required" },
        { status: 400 }
      );
    }

    const telegramId = Number(telegramIdParam);
    if (isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "telegram_id must be a valid number" },
        { status: 400 }
      );
    }

    const info = await getHujjatUsageInfo(telegramId);

    return NextResponse.json({
      success: true,
      stats: {
        plan: info.plan,
        used: info.used,
        limit: info.limit,
        isUnlimited: info.isUnlimited,
        maxPages: info.maxPages,
        maxFileMb: info.maxFileMb,
      },
    });
  } catch (error) {
    console.error("[hujjat-tozalash/stats] Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
