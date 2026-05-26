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
bot.command("help", async (ctx) => {
  await ctx.reply(`
🆘 Talaba AI — Yordam

Quyidagi buyruqlardan foydalaning:

🚀 /start — Botni ishga tushirish
📸 /scan — Bilet rasmini AI orqali tahlil qilish
ℹ️ /about — Talaba AI haqida ma'lumot

📌 Qanday ishlatish?

1️⃣ /scan bosing  
2️⃣ "Open Bilet Scan" tugmasini oching  
3️⃣ Bilet yoki savol rasmini yuklang  
4️⃣ 🚀 AI tahlil qilish ni bosing  
5️⃣ Tayyor shpargalka va Word faylni oling

👨‍💻 Developer bilan aloqa:

📸 Instagram: @iits_nkb  
✈️ Telegram: @Narkabilov_S_07

⚡ Muammo bo‘lsa:
Qayta urinib ko‘ring yoki /start ni qayta bosing.
  `);
});
bot.command("about", async (ctx) => {
  await ctx.reply(`
🎓 Talaba AI haqida

🤖 Talaba AI — talabalar uchun yaratilgan AI yordamchi platforma.

Maqsad:
📚 Bilet va savollarni AI orqali tahlil qilish  
📝 Tez shpargalka tayyorlash  
📄 Word (.docx) eksport qilish  
🧠 Quiz va testlar yaratish (tez orada)  
🤖 AI Chat (tez orada)

⚡ Hozirgi versiya:
Talaba AI MVP v1.0

👨‍💻 Developer:
📸 Instagram: @iits_nkb
✈️ Telegram: @Narkabilov_S_07

🔥 Powered by:
Gemini AI + Telegram Mini App + Railway
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