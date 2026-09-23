import { NextResponse } from "next/server";
import { recordLiveHeartbeat } from "@/lib/live-session-tracker";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const telegramId = Number(body.telegram_id);
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";

    // 1. Strict telegram_id validation
    if (!telegramId || isNaN(telegramId) || telegramId <= 0) {
      return NextResponse.json(
        { error: "Avtorizatsiyadan o'ting yoki Telegram orqali kiring." },
        { status: 401 }
      );
    }

    // 2. Strict session_id validation
    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id majburiy." },
        { status: 400 }
      );
    }

    const result = await recordLiveHeartbeat(sessionId, telegramId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Heartbeat qayta ishlanmadi." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      remainingSeconds: result.remainingSeconds,
      creditedSeconds: result.creditedSeconds,
      limitReached: Boolean(result.limitReached),
    });
  } catch (error: any) {
    console.error("[Live Heartbeat Error]:", error?.message || error);
    return NextResponse.json(
      { error: "Serverda xatolik yuz berdi." },
      { status: 500 }
    );
  }
}
