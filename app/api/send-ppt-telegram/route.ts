import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(
  req: Request
) {
  try {
    const body =
      await req.json();

    const {
      fileUrl,
      telegram_user_id,
    } = body;

    const botToken =
      process.env
        .TELEGRAM_BOT_TOKEN;

    if (
      !fileUrl ||
      !telegram_user_id
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing data",
        },
        {
          status: 400,
        }
      );
    }

    let fileBuffer: Buffer;
    let fileName = "Presentation.pptx";

    if (fileUrl.startsWith("data:")) {
      const base64Content = fileUrl.split(";base64,").pop() || "";
      fileBuffer = Buffer.from(base64Content, "base64");
    } else {
      const name = fileUrl.split("/").pop() || "Presentation.pptx";
      fileName = name;
      const filePath = path.join(
        process.cwd(),
        "public",
        name
      );
      fileBuffer = fs.readFileSync(filePath);
    }

    const formData =
      new FormData();

    formData.append(
      "chat_id",
      telegram_user_id.toString()
    );

    formData.append(
      "document",
      new Blob([
        new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength),
      ]),
      fileName
    );

    formData.append(
      "caption",
      "✅ PPT tayyor"
    );

    const telegramResponse =
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendDocument`,
        {
          method:
            "POST",
          body:
            formData,
        }
      );

    const data =
      await telegramResponse.json();

    console.log(
      "Telegram send:",
      data
    );

    return NextResponse.json(
      {
        success: true,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Telegram error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}