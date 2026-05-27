import { Telegraf } from "telegraf";
import { NextResponse } from "next/server";

const bot = new Telegraf(
  process.env.TELEGRAM_BOT_TOKEN!
);

// TELEGRAM FILE SEND
export async function sendFileToTelegram(
  userId: number,
  fileBuffer: Buffer,
  fileName: string
) {
  try {
    console.log(
      "Sending file to user:",
      userId
    );

    const result =
      await bot.telegram.sendDocument(
        userId,
        {
          source: fileBuffer,
          filename: fileName,
        },
        {
          caption:
            "✅ Faylingiz tayyor",
        }
      );

    console.log(
      "Telegram success:",
      result
    );

    return true;
  } catch (error) {
    console.error(
      "Telegram file send error:",
      error
    );

    throw error;
  }
}

// USER STATE
const userState: Record<
  number,
  string
> = {};

// START
bot.start(async (ctx) => {
  const userId =
    ctx.from.id;

  await ctx.reply(`
🎓 Talaba AI — AI Student Assistant

Assalomu alaykum 👋
Talaba AI ga xush kelibsiz!

📸 /scan — Bilet Scan
🆘 /help — Yordam
ℹ️ /about — Platforma haqida

Boshlash uchun:
/scan ni bosing
  `);

  // USER ID SAVE
  await ctx.reply(
    `🆔 User ID: ${userId}`
  );
});

// HELP
bot.command(
  "help",
  async (ctx) => {
    await ctx.reply(`
🆘 Talaba AI — Yordam

Buyruqlar:

🚀 /start — Botni ishga tushirish
📸 /scan — Bilet Scan
ℹ️ /about — Platforma haqida
    `);
  }
);

// ABOUT
bot.command(
  "about",
  async (ctx) => {
    await ctx.reply(`
🎓 Talaba AI haqida

🤖 Talaba AI —
talabalar uchun AI yordamchi.
    `);
  }
);

// SCAN
bot.command(
  "scan",
  async (ctx) => {
    const userId =
      ctx.from.id;

    await ctx.reply(
      `
📸 Bilet Scan

Usulni tanlang:
      `,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "🖥 Open Mini App",
                web_app: {
                  url:
                    `https://talaba-ai-production.up.railway.app?userId=${userId}`,
                },
              },
            ],
          ],
        },
      }
    );
  }
);

// PHOTO HANDLER
bot.on(
  "photo",
  async (ctx) => {
    const userId =
      ctx.from.id;

    if (
      userState[
        userId
      ] !==
      "waiting_for_scan"
    ) {
      return;
    }

    try {
      await ctx.reply(
        "🧠 AI tahlil qilmoqda..."
      );

      await ctx.reply(`
✅ Rasm qabul qilindi
      `);

      delete userState[
        userId
      ];
    } catch (
      error
    ) {
      console.log(
        error
      );

      await ctx.reply(
        "❌ Xatolik yuz berdi"
      );
    }
  }
);

// WEBHOOK
export async function POST(
  req: Request
) {
  const body =
    await req.json();

  try {
    await bot.handleUpdate(
      body
    );

    return NextResponse.json({
      ok: true,
    });
  } catch (
    error
  ) {
    console.error(
      error
    );

    return NextResponse.json(
      {
        error:
          "Telegram error",
      },
      {
        status: 500,
      }
    );
  }
}