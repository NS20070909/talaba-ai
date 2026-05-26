import { NextResponse } from "next/server";
import libre from "libreoffice-convert";
import { promisify } from "util";

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

    if (!file) {
      return NextResponse.json(
        {
          error: "Fayl topilmadi",
        },
        { status: 400 }
      );
    }

    // MUHIM: soffice path
    process.env.LIBREOFFICE_PATH =
      "C:\\Program Files\\LibreOffice\\program\\soffice.exe";

    const bytes =
      await file.arrayBuffer();

    const buffer = Buffer.from(
      bytes
    );

    const pdfBuffer =
      await convertAsync(
        buffer,
        ".pdf",
        undefined
      );

    return new Response(
      new Uint8Array(pdfBuffer),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${file.name.replace(
              ".pptx",
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
          "Convert qilishda xatolik",
      },
      { status: 500 }
    );
  }
}