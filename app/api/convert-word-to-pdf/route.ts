import { NextResponse } from "next/server";
import libre from "libreoffice-convert";
import { promisify } from "util";
import { sendFileToTelegram } from "@/app/api/telegram/route";
import { guardCheck, canUsePDF, incrementPDF } from "@/lib/limit-checker";

const convertAsync = promisify(
  libre.convert
);

export async function POST(
  request: Request
) {
  console.log("[DIAGNOSTICS] 1. Request received");
  try {
    const formData =
      await request.formData();

    const file = formData.get(
      "file"
    ) as File | null;

    if (file) {
      console.log("[DIAGNOSTICS] 2. File exists");
      console.log("[DIAGNOSTICS] 3. File name:", file.name);
    }

    const userId =
      formData.get(
        "telegram_user_id"
      ) as string | null;

    const telegramId = Number(userId);
    console.log("[DIAGNOSTICS] 4. telegram_user_id:", telegramId);
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
            "Fayl topilmadi",
        },
        {
          status: 400,
        }
      );
    }

    // LibreOffice path — not available on Vercel serverless
    const sofficePath = process.env.SOFFICE_PATH || "/usr/bin/soffice";
    process.env.SOFFICE_PATH = sofficePath;

    const { existsSync } = require("fs") as typeof import("fs");
    const hasSoffice = existsSync(sofficePath);

    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(bytes);

    let pdfBuffer: Buffer;

    if (hasSoffice) {
      console.log("[DIAGNOSTICS] 5. Validation result: hasSoffice = true");
      console.log("[DIAGNOSTICS] 6. Conversion start (Soffice)");
      // DOCX → PDF
      pdfBuffer =
        await convertAsync(
          buffer,
          ".pdf",
          undefined
        );
    } else if (process.env.CLOUDCONVERT_API_KEY) {
      console.log("[DIAGNOSTICS] 5. Validation result: hasSoffice = false, using CloudConvert");
      console.log("[DIAGNOSTICS] 6. Conversion start (CloudConvert)");
      const { convertWithCloudConvert } = await import("@/lib/cloudconvert");
      pdfBuffer = await convertWithCloudConvert(buffer, file.name, "docx", "pdf");
    } else {
      return NextResponse.json(
        {
          error:
            "Word → PDF Vercelda qo'llab-quvvatlanmaydi. Iltimos CloudConvert API kalitini o'rnating yoki Railwaydan foydalaning.",
        },
        { status: 503 }
      );
    }

    // TELEGRAMGA YUBORISH
    if (
      sendToTelegram &&
      userId
    ) {
      await sendFileToTelegram(
        Number(userId),
        pdfBuffer,
        "talaba-ai.pdf"
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
        pdfBuffer
      ),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            'attachment; filename="talaba-ai.pdf"',
        },
      }
    );
  } catch (error) {
    console.error(
      "Word to PDF error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Word ni PDF ga aylantirishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}