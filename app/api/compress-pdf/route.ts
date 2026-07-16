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
      process.env.GHOSTSCRIPT_PATH ||
      "/usr/bin/gs";

    const { existsSync } = require("fs") as typeof import("fs");
    const hasGhostscript = existsSync(ghostscriptPath);

    let compressedPdf: Buffer;

    if (hasGhostscript) {
      await fs.writeFile(
        inputPath,
        Buffer.from(
          bytes
        )
      );

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

      compressedPdf =
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
    } else if (process.env.CLOUDCONVERT_API_KEY) {
      // clean up unused temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {}

      const { optimizePDFWithCloudConvert } = await import("@/lib/cloudconvert");
      let ccProfile: "web" | "print" | "archive" = "web";
      if (pdfSetting === "/printer") {
        ccProfile = "print";
      }

      compressedPdf = await optimizePDFWithCloudConvert(
        Buffer.from(bytes),
        file.name,
        ccProfile
      );
    } else {
      // clean up unused temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (err) {}

      return NextResponse.json(
        {
          error:
            "PDF compress Vercelda qo'llab-quvvatlanmaydi. Iltimos CloudConvert API kalitini o'rnating yoki Railwaydan foydalaning.",
        },
        { status: 503 }
      );
    }

    await incrementPDF(telegramId);

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