import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  Document,
  Packer,
  Paragraph,
} from "docx";
import fs from "fs";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { sendFileToTelegram } from "@/app/api/telegram/route";
import { canUsePDF, incrementPDF } from "@/lib/limit-checker";

const execAsync =
  promisify(exec);

const ai =
  new GoogleGenAI({
    apiKey:
      process.env
        .GEMINI_DOCUMENT_API_KEY!,
  });

// FALLBACK MODELS
const MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
];

// OCR GENERATOR
async function generateOCR(
  base64: string
) {
  let lastError;

  for (const model of MODELS) {
    try {
      console.log(
        `Trying model: ${model}`
      );

      const result =
        await ai.models.generateContent(
          {
            model,
            contents: [
              {
                role:
                  "user",
                parts: [
                  {
                    text:
                      "Bu PDF sahifasidagi barcha matnni xatosiz OCR qilib chiqar. Hech narsani qisqartirma. Matn strukturasini saqla.",
                  },
                  {
                    inlineData:
                      {
                        mimeType:
                          "image/png",
                        data: base64,
                      },
                  },
                ],
              },
            ],
          }
        );

      console.log(
        `Success model: ${model}`
      );

      return (
        result.text ||
        ""
      );
    } catch (
      error
    ) {
      console.log(
        `Failed model: ${model}`
      );

      console.error(
        error
      );

      lastError =
        error;

      continue;
    }
  }

  throw lastError;
}

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
    if (telegramId && !isNaN(telegramId)) {
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
        { status: 400 }
      );
    }

    const tempDir =
      os.tmpdir();

    const pdfPath =
      path.join(
        tempDir,
        `${Date.now()}.pdf`
      );

    const imgDir =
      path.join(
        tempDir,
        `pdf-images-${Date.now()}`
      );

    fs.mkdirSync(
      imgDir
    );

    const bytes =
      await file.arrayBuffer();

    fs.writeFileSync(
      pdfPath,
      Buffer.from(
        bytes
      )
    );

    // PDF → PNG
    await execAsync(`
      pdftoppm -png "${pdfPath}" "${imgDir}/page"
    `);

    const imageFiles =
      fs
        .readdirSync(
          imgDir
        )
        .filter((f) =>
          f.endsWith(
            ".png"
          )
        );

    let finalText =
      "";

    for (const img of imageFiles) {
      const imagePath =
        path.join(
          imgDir,
          img
        );

      const base64 =
        fs
          .readFileSync(
            imagePath
          )
          .toString(
            "base64"
          );

      // OCR
      const text =
        await generateOCR(
          base64
        );

      finalText +=
        text +
        "\n\n";
    }

    // DOCX
    const doc =
      new Document({
        sections: [
          {
            properties:
              {},
            children:
              finalText
                .split(
                  "\n"
                )
                .map(
                  (
                    line
                  ) =>
                    new Paragraph(
                      line
                    )
                ),
          },
        ],
      });

    const buffer =
      await Packer.toBuffer(
        doc
      );

    // CLEANUP
    fs.rmSync(
      imgDir,
      {
        recursive:
          true,
        force:
          true,
      }
    );

    fs.unlinkSync(
      pdfPath
    );

    const fileName =
      file.name.replace(
        ".pdf",
        ".docx"
      );

    // TELEGRAM
    if (
      sendToTelegram &&
      userId
    ) {
      await sendFileToTelegram(
        Number(
          userId
        ),
        Buffer.from(
          buffer
        ),
        fileName
      );

      if (telegramId && !isNaN(telegramId)) {
        await incrementPDF(telegramId);
      }

      return NextResponse.json(
        {
          success:
            true,
        }
      );
    }

    // DOWNLOAD
    if (telegramId && !isNaN(telegramId)) {
      await incrementPDF(telegramId);
    }

    return new Response(
      new Uint8Array(
        buffer
      ),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "PDF to Word error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "PDF → Word xatolik",
      },
      {
        status: 500,
      }
    );
  }
}