export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { guardCheck, canUseReferat, incrementReferat } from "@/lib/limit-checker";
import { formatReferatDocx } from "@/lib/referat-formatter";
import { sendFileToTelegram } from "@/app/api/telegram/route";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type DeliveryMode = "download" | "telegram" | "both";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const userId = formData.get("telegram_user_id") as string | null;
    const deliveryRaw = (formData.get("delivery") as string) || "download";
    const legacyTelegram = formData.get("send_to_telegram") === "true";

    let delivery: DeliveryMode = "download";
    if (deliveryRaw === "telegram" || deliveryRaw === "both") delivery = deliveryRaw;
    else if (legacyTelegram) delivery = "telegram";

    const telegramId = Number(userId);
    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "telegram_user_id is required" },
        { status: 400 }
      );
    }

    const guard = await guardCheck(telegramId);
    if (guard.blocked) {
      return NextResponse.json(
        {
          success: false,
          code: guard.result?.banned ? "BANNED" : "FORBIDDEN",
          error: guard.result?.banned ? "🚫 Siz bloklangansiz" : "Ruxsat etilmagan",
        },
        { status: 403 }
      );
    }

    const limitCheck = await canUseReferat(telegramId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "LIMIT_REACHED",
          error: "Sizning bugungi referat limiti tugagan. Ertaga yana urinib ko'ring yoki tarifni yangilang.",
        },
        { status: 403 }
      );
    }

    if (!file) {
      return NextResponse.json({ success: false, error: "Fayl topilmadi" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".docx")) {
      return NextResponse.json(
        { success: false, error: "Faqat .docx formatdagi Word fayllar qabul qilinadi" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: "Fayl hajmi 5 MB dan oshmasligi kerak" },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const formattedBuffer = await formatReferatDocx(inputBuffer);
    const outputName = file.name.replace(/\.docx$/i, "") + "_OTM.docx";

    if (delivery === "telegram" || delivery === "both") {
      await sendFileToTelegram(telegramId, formattedBuffer, outputName);
    }

    await incrementReferat(telegramId);

    if (delivery === "telegram") {
      return NextResponse.json({
        success: true,
        fileName: outputName,
        telegramSent: true,
      });
    }

    return new Response(new Uint8Array(formattedBuffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outputName}"`,
        "X-Telegram-Sent": delivery === "both" ? "true" : "false",
        "X-Output-Name": outputName,
      },
    });
  } catch (error: unknown) {
    console.error("[format-referat] Error:", error);
    const message =
      error instanceof Error ? error.message : "Referat formatlashda xatolik yuz berdi";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
