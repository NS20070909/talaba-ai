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

    const userId =
      formData.get(
        "telegram_user_id"
      ) as string | null;

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

    // DOCX → PDF
    const pdfBuffer =
      await convertAsync(
        buffer,
        ".pdf",
        undefined
      );

    // TELEGRAMGA YUBORISH
    if (userId) {
      await sendFileToTelegram(
        Number(userId),
        pdfBuffer,
        file.name.replace(
          ".docx",
          ".pdf"
        )
      );
    }

    return new Response(
      new Uint8Array(
        pdfBuffer
      ),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${file.name.replace(
              ".docx",
              ".pdf"
            )}"`,
        },
      }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Word ni PDF ga aylantirishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}