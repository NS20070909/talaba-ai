import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

    // Temp paths
    const tempDir =
      os.tmpdir();

    const pdfPath =
      path.join(
        tempDir,
        `${Date.now()}.pdf`
      );

    const docxPath =
      path.join(
        tempDir,
        `${Date.now()}.docx`
      );

    // Save uploaded PDF
    const bytes =
      await file.arrayBuffer();

    fs.writeFileSync(
      pdfPath,
      Buffer.from(bytes)
    );

    // Python convert
    await execAsync(
      `python3 convert.py "${pdfPath}" "${docxPath}"`
    );

    // Read DOCX
    const docxBuffer =
      fs.readFileSync(
        docxPath
      );

    // Cleanup
    fs.unlinkSync(pdfPath);
    fs.unlinkSync(docxPath);

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