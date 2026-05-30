import { NextResponse } from "next/server";

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

    const fullFileUrl =
      `${process.env.APP_URL}${fileUrl}`;
      console.log(
  "FILE URL:",
  fileUrl
);

console.log(
  "FULL URL:",
  fullFileUrl
);

   const formData =
  new FormData();

formData.append(
  "chat_id",
  telegram_user_id.toString()
);

const fileResponse =
  await fetch(
    fullFileUrl
  );

const fileBlob =
  await fileResponse.blob();

formData.append(
  "document",
  fileBlob,
  fileUrl
    .split("/")
    .pop() ||
    "presentation.pptx"
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