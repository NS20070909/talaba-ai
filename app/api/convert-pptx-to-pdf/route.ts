import { NextResponse } from "next/server";
import libre from "libreoffice-convert";
import { promisify } from "util";
import { sendFileToTelegram } from "@/app/api/telegram/route";

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

    // YANGI
    const userId =
      formData.get(
        "telegram_user_id"
      ) as string | null;

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

      return NextResponse.json({
        success: true,
      });
    }

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