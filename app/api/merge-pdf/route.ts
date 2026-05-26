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

    const files =
      formData.getAll(
        "files"
      ) as File[];

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

    return new Response(
      new Uint8Array(
        mergedBytes
      ),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            'attachment; filename="merged.pdf"',
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