import { NextResponse } from "next/server";
import {
  getActiveUserSession,
  saveUserSession,
  clearUserSession,
  QuizUserSession,
} from "@/lib/quiz/session-manager";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = Number(searchParams.get("telegram_id"));

    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ success: false, error: "telegram_id is required" }, { status: 400 });
    }

    const activeSession = await getActiveUserSession(telegramId);
    return NextResponse.json({
      success: true,
      hasActiveSession: !!activeSession,
      session: activeSession,
    });
  } catch (error: any) {
    console.error("Quiz session GET error:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QuizUserSession;
    if (!body.userId) {
      return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
    }

    const saved = await saveUserSession(body);
    return NextResponse.json({ success: saved });
  } catch (error: any) {
    console.error("Quiz session POST error:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = Number(searchParams.get("telegram_id"));

    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ success: false, error: "telegram_id is required" }, { status: 400 });
    }

    const cleared = await clearUserSession(telegramId);
    return NextResponse.json({ success: cleared });
  } catch (error: any) {
    console.error("Quiz session DELETE error:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
