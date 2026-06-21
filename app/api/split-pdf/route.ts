import { NextResponse } from "next/server";
import {
  PDFDocument,
} from "pdf-lib";
import { sendFileToTelegram } from "@/app/api/telegram/route";
import { guardCheck, canUsePDF, incrementPDF } from "@/lib/limit-checker";

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      ) as File | null;

    const startPage =
      Number(
        formData.get(
          "startPage"
        )
      );

    const endPage =
      Number(
        formData.get(
          "endPage"
        )
      );

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
            "PDF topilmadi",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !startPage ||
      !endPage ||
      startPage < 1 ||
      endPage <
        startPage
    ) {
      return NextResponse.json(
        {
          error:
            "Bet oralig‘i noto‘g‘ri",
        },
        {
          status: 400,
        }
      );
    }

    const bytes =
      await file.arrayBuffer();

    const pdf =
      await PDFDocument.load(
        bytes
      );

    const totalPages =
      pdf.getPageCount();

    if (
      endPage >
      totalPages
    ) {
      return NextResponse.json(
        {
          error: `PDF faqat ${totalPages} bet`,
        },
        {
          status: 400,
        }
      );
    }

    const newPdf =
      await PDFDocument.create();

    const pageIndexes =
      Array.from(
        {
          length:
            endPage -
            startPage +
            1,
        },
        (_, i) =>
          startPage -
          1 +
          i
      );

    const copiedPages =
      await newPdf.copyPages(
        pdf,
        pageIndexes
      );

    copiedPages.forEach(
      (page) => {
        newPdf.addPage(
          page
        );
      }
    );

    const pdfBytes =
      await newPdf.save();

    const fileName =
      `split-${file.name}`;

    // TELEGRAMGA YUBORISH
    if (
      sendToTelegram &&
      userId
    ) {
      await sendFileToTelegram(
        Number(userId),
        Buffer.from(
          pdfBytes
        ),
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
        pdfBytes
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
      error
    );

    return NextResponse.json(
      {
        error:
          "PDF bo‘lishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}