import { NextResponse } from "next/server";
import { getUserQuizHistory, deleteQuizHistoryRecord } from "@/lib/quiz/storage";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = Number(searchParams.get("telegram_id"));

    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ success: false, error: "telegram_id required" }, { status: 400 });
    }

    const history = await getUserQuizHistory(telegramId);
    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    console.error("Quiz history GET error:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const telegramId = Number(searchParams.get("telegram_id"));

    if (!id || !telegramId || isNaN(telegramId)) {
      return NextResponse.json({ success: false, error: "id and telegram_id required" }, { status: 400 });
    }

    const deleted = await deleteQuizHistoryRecord(id, telegramId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Topilmadi yoki o'chirib bo'lmadi" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "O'chirildi" });
  } catch (error: any) {
    console.error("Quiz history DELETE error:", error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
