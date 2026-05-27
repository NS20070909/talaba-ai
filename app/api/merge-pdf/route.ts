import { NextResponse } from "next/server";
import {
  PDFDocument,
} from "pdf-lib";
import { sendFileToTelegram } from "@/app/api/telegram/route";

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const files =
      formData.getAll(
        "files"
      ) as File[];

    // YANGI
    const userId =
      formData.get(
        "telegram_user_id"
      ) as string | null;

    const sendToTelegram =
      formData.get(
        "send_to_telegram"
      ) === "true";

    if (
      !files ||
      files.length < 2
    ) {
      return NextResponse.json(
        {
          error:
            "Kamida 2 ta PDF kerak",
        },
        {
          status: 400,
        }
      );
    }

    const mergedPdf =
      await PDFDocument.create();

    for (const file of files) {
      const bytes =
        await file.arrayBuffer();

      const pdf =
        await PDFDocument.load(
          bytes
        );

      const copiedPages =
        await mergedPdf.copyPages(
          pdf,
          pdf.getPageIndices()
        );

      copiedPages.forEach(
        (page) => {
          mergedPdf.addPage(
            page
          );
        }
      );
    }

    const mergedBytes =
      await mergedPdf.save();

    const fileName =
      "merged.pdf";

    // TELEGRAMGA YUBORISH
    if (
      sendToTelegram &&
      userId
    ) {
      await sendFileToTelegram(
        Number(userId),
        Buffer.from(
          mergedBytes
        ),
        fileName
      );

      return NextResponse.json({
        success: true,
      });
    }

    // BROWSER DOWNLOAD
    return new Response(
      new Uint8Array(
        mergedBytes
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
          "PDF birlashtirishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}