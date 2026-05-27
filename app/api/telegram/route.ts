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
  } catch (error) {
    console.error(
      "Telegram file send error:",
      error
    );
  }
}

// USER STATE
const userState: Record<
  number,
  string
> = {};
// START
bot.start(async (ctx) => {
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

Qanday ishlaydi?

🖥 Kompyuter:
Mini App orqali

📱 Telefon:
Telegram ichida rasm yuborib

⚡ Muammo bo‘lsa:
/start ni qayta bosing
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

Imkoniyatlar:

📸 Bilet Scan
📄 File Tools
📝 Word export
🧠 Quiz (tez orada)
🤖 AI Chat (tez orada)

⚡ Versiya:
MVP v1.0

🔥 Powered by:
Gemini AI
Telegram Bot
Railway
    `);
  }
);

// SCAN COMMAND
bot.command(
  "scan",
  async (ctx) => {
    await ctx.reply(
      `
📸 Bilet Scan

Usulni tanlang:

🖥 Kompyuter —
Mini App

📱 Telefon —
Telegram ichida
scan qilish
      `,
      {
        reply_markup: {
          inline_keyboard:
            [
              [
                {
                  text:
                    "🖥 Open Mini App",

                  web_app: {
                    url:
                      "https://talaba-ai-production.up.railway.app?tab=scan",
                  },
                },
              ],

              [
                {
                  text:
                    "📱 Telegram Scan",

                  callback_data:
                    "telegram_scan",
                },
              ],
            ],
        },
      }
    );
  }
);

// BUTTON HANDLER
bot.action(
  "telegram_scan",
  async (ctx) => {
    const userId =
      ctx.from.id;

    userState[
      userId
    ] =
      "waiting_for_scan";

    await ctx.answerCbQuery();

    await ctx.reply(`
📸 Telegram Scan boshlandi

Iltimos,
bilet yoki savol
rasmini yuboring.

AI:
✅ Savolni aniqlaydi
✅ Javob tayyorlaydi
✅ Word fayl yaratadi
    `);
  }
);

// PHOTO HANDLER
bot.on(
  "photo",
  async (ctx) => {
    const userId =
      ctx.from.id;

    // scan mode emas
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

      const photos =
        ctx.message.photo;

      const photo =
        photos[
          photos.length - 1
        ];

      // TELEGRAM FILE
      const file =
        await ctx.telegram.getFile(
          photo.file_id
        );

      const fileUrl =
        `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

      console.log(
        "IMAGE URL:",
        fileUrl
      );

      // TEMP RESPONSE
      await ctx.reply(`
✅ Rasm qabul qilindi

📸 AI savollarni aniqladi

⏳ Keyingi bosqich:
Gemini analyze
va Word export
      `);

      // RESET STATE
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