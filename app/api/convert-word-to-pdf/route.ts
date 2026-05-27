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

    // Railway Linux path
    process.env.SOFFICE_PATH =
      "/usr/bin/soffice";

    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(bytes);

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
              ".docx",
              ".pdf"
            )}"`,
        },
      }
    );
  } catch (error) {
    console.error(
      "PDF convert error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Word ni PDF ga aylantirishda xatolik",
      },
      { status: 500 }
    );
  }
}