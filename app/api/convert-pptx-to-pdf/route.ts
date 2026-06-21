import { NextResponse } from "next/server";
import libre from "libreoffice-convert";
import { promisify } from "util";
import { sendFileToTelegram } from "@/app/api/telegram/route";
import { guardCheck, canUsePDF, incrementPDF } from "@/lib/limit-checker";

const convertAsync = promisify(
  libre.convert
);

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const file = formData.get(
      "file"
    ) as File | null;

    const userId =
      formData.get(
        "telegram_user_id"
      ) as string | null;

    const telegramId = Number(userId);
    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ error: "telegram_user_id is required" }, { status: 400 });
    }

    const guard = await guardCheck(telegramId);
    if (guard.blocked && guard.result?.banned) {
      return NextResponse.json(
        {
          success: false,
          code: "BANNED",
          message: "🚫 Siz bloklangansiz",
        },
        { status: 403 }
      );
    }

    const limitCheck = await canUsePDF(telegramId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "LIMIT_REACHED",
          message: "Sizning kunlik PDF limiti tugagan.",
        },
        { status: 403 }
      );
    }

    const sendToTelegram =
      formData.get(
        "send_to_telegram"
      ) === "true";

    if (!file) {
      return NextResponse.json(
        {
          error:
            "Fayl topilmadi",
        },
        {
          status: 400,
        }
      );
    }

    // Railway Linux path
    process.env.SOFFICE_PATH =
      "/usr/bin/soffice";

    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(bytes);

    // PPTX → PDF
    const pdfBuffer =
      await convertAsync(
        buffer,
        ".pdf",
        undefined
      );

    const fileName =
      file.name.replace(
        ".pptx",
        ".pdf"
      );

    // TELEGRAMGA YUBORISH
    if (
      sendToTelegram &&
      userId
    ) {
      await sendFileToTelegram(
        Number(userId),
        pdfBuffer,
        fileName
      );

      await incrementPDF(telegramId);

      return NextResponse.json({
        success: true,
      });
    }

    await incrementPDF(telegramId);

    // BROWSER DOWNLOAD
    return new Response(
      new Uint8Array(
        pdfBuffer
      ),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,
        },
      }
    );
  } catch (error) {
    console.error(
      "PPTX to PDF error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Convert qilishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}