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

const execAsync =
  promisify(exec);

const ai =
  new GoogleGenAI({
    apiKey:
      process.env
        .GEMINI_DOCUMENT_API_KEY!,
  });

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const file = formData.get(
      "file"
    ) as File | null;

    // YANGI
    const userId =
      formData.get(
        "telegram_user_id"
      ) as string | null;

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

    fs.mkdirSync(imgDir);

    const bytes =
      await file.arrayBuffer();

    fs.writeFileSync(
      pdfPath,
      Buffer.from(bytes)
    );

    // PDF → PNG
    await execAsync(`
      pdftoppm -png "${pdfPath}" "${imgDir}/page"
    `);

    const imageFiles =
      fs
        .readdirSync(imgDir)
        .filter((f) =>
          f.endsWith(".png")
        );

    let finalText = "";

    for (const img of imageFiles) {
      const imagePath =
        path.join(
          imgDir,
          img
        );

      const base64 =
        fs.readFileSync(
          imagePath
        ).toString("base64");

      const result =
        await ai.models.generateContent(
          {
            model:
              "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text:
                      "Bu PDF sahifasidagi barcha matnni xatosiz OCR qilib chiqar. Hech narsani qisqartirma.",
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

      finalText +=
        result.text +
        "\n\n";
    }

    // DOCX yaratish
    const doc =
      new Document({
        sections: [
          {
            properties:
              {},
            children:
              finalText
                .split("\n")
                .map(
                  (line) =>
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
    fs.rmSync(imgDir, {
      recursive: true,
      force: true,
    });

    fs.unlinkSync(pdfPath);

    const fileName =
      file.name.replace(
        ".pdf",
        ".docx"
      );

    // TELEGRAMGA YUBORISH
    if (
      sendToTelegram &&
      userId
    ) {
      await sendFileToTelegram(
        Number(userId),
        Buffer.from(buffer),
        fileName
      );

      return NextResponse.json(
        {
          success: true,
        }
      );
    }

    // BROWSER DOWNLOAD
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
  } catch (error) {
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