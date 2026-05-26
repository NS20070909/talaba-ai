import { Telegraf } from "telegraf";
import { NextResponse } from "next/server";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

bot.start(async (ctx) => {
  await ctx.reply(`
🎓 Talaba AI — AI Student Assistant

Assalomu alaykum 👋
Talaba AI ga xush kelibsiz!

📸 Bilet Scan
📄 PDF/PPTX (tez orada)
🧠 Quiz (tez orada)
🤖 AI Chat (tez orada)
📝 Smart Notes (tez orada)

📸 Boshlash uchun bilet rasmini yuboring.
  `);
});

bot.command("scan", async (ctx) => {
  await ctx.reply("📸 Bilet Scan ochilmoqda...", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "📸 Open Bilet Scan",
            web_app: {
              url: "https://talaba-ai-production.up.railway.app?tab=scan",
            },
          },
        ],
      ],
    },
  });
});

export async function POST(req: Request) {
  const body = await req.json();

  try {
    await bot.handleUpdate(body);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Telegram error",
      },
      {
        status: 500,
      }
    );
  }
}