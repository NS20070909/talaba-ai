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
          error:
            "Fayl topilmadi",
        },
        {
          status: 400,
        }
      );
    }

    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(bytes);

    // Linux Docker path
    process.env.SOFFICE_PATH =
      "/usr/bin/soffice";

    // PDF → DOCX
    const docxBuffer =
      await convertAsync(
        buffer,
        ".docx",
        undefined
      );

    return new Response(
      new Uint8Array(
        docxBuffer
      ),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

          "Content-Disposition":
            `attachment; filename="${file.name.replace(
              ".pdf",
              ".docx"
            )}"`,
        },
      }
    );
  } catch (error) {
    console.error(
      "PDF to Word error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "PDF → Word da xatolik",
      },
      {
        status: 500,
      }
    );
  }
}