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

    const telegramResponse =
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendDocument`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              chat_id:
                telegram_user_id,
              document:
                fullFileUrl,
              caption:
                "✅ PPT tayyor",
            }),
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