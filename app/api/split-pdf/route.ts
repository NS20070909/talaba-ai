import { NextResponse } from "next/server";
import {
  PDFDocument,
} from "pdf-lib";

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
        (
          _,
          i
        ) =>
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

    return new Response(
      new Uint8Array(
        pdfBytes
      ),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="split-${file.name}"`,
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