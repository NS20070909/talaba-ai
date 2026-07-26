import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileBase64, telegram_user_id, caption } = body;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error("[send-referat-telegram] TELEGRAM_BOT_TOKEN is not set.");
      return NextResponse.json({ success: false, error: "Server configuration error" }, { status: 500 });
    }

    if (!fileBase64 || !telegram_user_id) {
      return NextResponse.json({ success: false, error: "Missing data" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(fileBase64, "base64");
    const fileName = `TalabaAI-Referat.docx`;

    const formData = new FormData();
    formData.append("chat_id", telegram_user_id.toString());
    formData.append("document", new Blob([new Uint8Array(fileBuffer)]), fileName);
    formData.append("caption", caption || "✅ Referat tayyor! TalabaAI tomonidan yaratildi.");

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      { method: "POST", body: formData }
    );

    const data = await telegramRes.json();
    console.log("[send-referat-telegram] Telegram response:", data.ok);

    if (!data.ok) {
      return NextResponse.json({ success: false, error: data.description || "Telegram error" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[send-referat-telegram] Error:", error?.message || error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
