import { Telegraf, Input } from "telegraf";
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
        Input.fromBuffer(
          fileBuffer,
          fileName
        ),
        {
          caption:
            "✅ PDF faylingiz tayyor",
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
  const userId = ctx.from?.id;
  await ctx.replyWithHTML(
    `🎓 <b>Talaba AI</b>\n\n` +
    `Assalomu alaykum, <b>${ctx.from?.first_name || "Talaba"}</b>! 👋\n\n` +
    `Talabalar uchun zamonaviy AI yordamchi platformasiga xush kelibsiz.\n\n` +
    `📚 <b>Buyruqlar:</b>\n` +
    `• 🚀 /talabaai — Mini App\n` +
    `• 📸 /scan — Bilet Scan\n` +
    `• 🆘 /help — Yordam\n` +
    `• ℹ️ /about — Platforma haqida\n\n` +
    `Boshlash uchun quyidagi tugmalardan birini bosing 👇`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "🚀 Talaba AI ochish",
              web_app: {
                url: "https://talaba-ai-production.up.railway.app",
              },
            },
          ],
          [
            {
              text: "📸 Bilet Scan",
              web_app: {
                url: `https://talaba-ai-production.up.railway.app?tab=scan&userId=${userId}`,
              },
            },
          ],
        ],
      },
    }
  );
});

// TALABA AI
bot.command(
  "talabaai",
  async (ctx) => {
    await ctx.reply(
      `
🎓 Talaba AI

AI Student Assistant 🚀

Mini App ni ochish uchun
pastdagi tugmani bosing 👇
`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "🚀 Open Talaba AI",
                web_app: {
                  url:
                    "https://talaba-ai-production.up.railway.app",
                },
              },
            ],
          ],
        },
      }
    );
  }
);

// HELP
bot.command(
  "help",
  async (ctx) => {
    await ctx.replyWithHTML(
      `🆘 <b>Talaba AI — Yordam Markazi</b>\n\n` +
      `<b>Buyruqlar:</b>\n` +
      `• <code>/start</code> — Botni ishga tushirish\n` +
      `• <code>/talabaai</code> — Mini App\n` +
      `• <code>/scan</code> — Bilet Scan\n` +
      `• <code>/about</code> — Platforma haqida\n\n` +
      `🛠 <b>Imkoniyatlar:</b>\n` +
      `• 📄 <b>PDF Tools</b>\n` +
      `• 📊 <b>AI Slayd</b>\n` +
      `• 📸 <b>Bilet Scan</b>\n` +
      `• 🤖 <b>AI Assistant</b>\n\n` +
      `📞 <b>Qo'llab-quvvatlash (Support):</b>\n` +
      `Telegram: @Narkabilov_S_07`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Platformani ochish",
                web_app: {
                  url: "https://talaba-ai-production.up.railway.app",
                },
              },
            ],
          ],
        },
      }
    );
  }
);

// ABOUT
bot.command(
  "about",
  async (ctx) => {
    await ctx.replyWithHTML(
      `🎓 <b>Talaba AI</b>\n\n` +
      `🤖 <i>AI platform for students.</i>\n\n` +
      `⚡ <b>Texnologiyalar (Technology stack):</b>\n` +
      `• Gemini AI\n` +
      `• Next.js\n` +
      `• Supabase\n` +
      `• Railway\n` +
      `• Telegram Bot\n\n` +
      `📁 <b>Versiya:</b> MVP v1.0`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📷 Instagram",
                url: "https://instagram.com/iits_nkb",
              },
              {
                text: "✈️ Telegram",
                url: "https://t.me/Narkabilov_S_07",
              },
            ],
          ],
        },
      }
    );
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

Bilet Scan ochish uchun
pastdagi tugmani bosing 👇
`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text:
                  "📸 Open Bilet Scan",
                web_app: {
                  url:
                    `https://talaba-ai-production.up.railway.app?tab=scan&userId=${userId}`,
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