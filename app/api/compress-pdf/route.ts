import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  execFile,
} from "child_process";
import {
  promisify,
} from "util";

const execFileAsync =
  promisify(execFile);

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

    const targetSize =
      Number(
        formData.get(
          "targetSize"
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

    const originalSizeMb =
      file.size /
      1024 /
      1024;

    const tempDir =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          "pdf-compress-"
        )
      );

    const inputPath =
      path.join(
        tempDir,
        "input.pdf"
      );

    const outputPath =
      path.join(
        tempDir,
        "output.pdf"
      );

    const bytes =
      await file.arrayBuffer();

    await fs.writeFile(
      inputPath,
      Buffer.from(
        bytes
      )
    );

    // Compression level
    let pdfSetting =
      "/ebook";

    const ratio =
      targetSize > 0
        ? targetSize /
          originalSizeMb
        : 1;

    if (ratio <= 0.35) {
      pdfSetting =
        "/screen";
    } else if (
      ratio <= 0.6
    ) {
      pdfSetting =
        "/ebook";
    } else {
      pdfSetting =
        "/printer";
    }

    const ghostscriptPath =
      `C:\\Program Files\\gs\\gs10.07.1\\bin\\gswin64c.exe`;

    await execFileAsync(
      ghostscriptPath,
      [
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        `-dPDFSETTINGS=${pdfSetting}`,
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ]
    );

    const compressedPdf =
      await fs.readFile(
        outputPath
      );

    // temp cleanup
    await fs.rm(
      tempDir,
      {
        recursive:
          true,
        force: true,
      }
    );

    return new Response(
      compressedPdf,
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="compressed-${file.name}"`,
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
          "PDF compress qilishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}