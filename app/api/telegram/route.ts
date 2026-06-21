import { Telegraf, Input } from "telegraf";
import { NextResponse } from "next/server";
import { isOwner, isAdmin, getSystemStats, getUserInfo, getAllUserIds, getPremiumUsers, getAdmins, addAdmin, removeAdmin, givePremium, removePremium, isValidPaidPlan, banUser, unbanUser } from "@/lib/admin";
import { getUser } from "@/lib/storage";

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
    `• 💎 /premium — Premium tariflar\n` +
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

// PREMIUM
bot.command(
  "premium",
  async (ctx) => {
    await ctx.replyWithHTML(
      `👑 <b>Talaba AI Premium Tariflari</b>\n\n` +
      `Ehtiyojingizga mos tarifni tanlang va barcha imkoniyatlardan to'liq foydalaning:\n\n` +
      `🟢 <b>Starter</b> — 2 900 so'm\n` +
      `📅 1 kun\n` +
      `📸 Scan: 5\n` +
      `📊 PPT: 3\n` +
      `📄 PDF: 5\n\n` +
      `🔵 <b>Weekly</b> — 11 900 so'm\n` +
      `📅 7 kun\n` +
      `📸 Scan: 50\n` +
      `📊 PPT: 20\n` +
      `📄 PDF: 50\n\n` +
      `🟣 <b>Premium ⭐</b> — 29 900 so'm\n` +
      `📅 30 kun\n` +
      `📸 Scan: 300\n` +
      `📊 PPT: 120\n` +
      `📄 PDF: 300\n\n` +
      `🟠 <b>Pro 🔥</b> — 69 900 so'm\n` +
      `📅 90 kun\n` +
      `📸 Scan: 1200\n` +
      `📊 PPT: 500\n` +
      `📄 PDF: 1200\n\n` +
      `👑 <b>Elite</b> — 199 900 so'm\n` +
      `📅 365 kun\n` +
      `📸 Scan: 6000\n` +
      `📊 PPT: 2500\n` +
      `📄 PDF: 6000\n\n` +
      `👇 Tariflarni faollashtirish va sotib olish uchun pastdagi tugmani bosing:`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🚀 Tariflarni ochish",
                web_app: {
                  url: "https://talaba-ai-production.up.railway.app/premium",
                },
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

// OWNER ONLY /admin COMMAND
bot.command("admin", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Visible ONLY to OWNER. Admins should NOT see the owner panel.
  if (!isOwner(userId)) return;

  await renderMainPanel(ctx);
});

// MAIN OWNER PANEL RENDERER
async function renderMainPanel(ctx: any) {
  try {
    const stats = await getSystemStats();
    const text = 
      `🛡 <b>Talaba AI Owner Panel</b>\n\n` +
      `👥 <b>Users:</b> ${stats.totalUsers}\n` +
      `💎 <b>Premium:</b> ${stats.premiumUsers}\n` +
      `🆓 <b>Free:</b> ${stats.freeUsers}\n\n` +
      `📸 <b>Scan Today:</b> ${stats.scanToday}\n` +
      `📊 <b>PPT Today:</b> ${stats.pptToday}\n` +
      `📄 <b>PDF Today:</b> ${stats.pdfToday}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔍 User Search", callback_data: "admin:search" },
          { text: "📢 Broadcast", callback_data: "admin:broadcast" }
        ],
        [
          { text: "👑 Admins", callback_data: "admin:admins" },
          { text: "💎 Premium", callback_data: "admin:premium" }
        ],
        [
          { text: "🚫 Ban System", callback_data: "admin:ban" },
          { text: "📊 Statistics", callback_data: "admin:stats" }
        ]
      ]
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
    } else {
      await ctx.replyWithHTML(text, { reply_markup: keyboard });
    }
  } catch (error) {
    console.error("renderMainPanel error:", error);
  }
}

// SUBMENU RENDERERS
async function renderAdminsMenu(ctx: any) {
  const text = `👑 <b>Admin Management</b>\n\nManage bot administrators.`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: "➕ Add Admin", callback_data: "admin:admins:add" },
        { text: "➖ Remove Admin", callback_data: "admin:admins:remove" }
      ],
      [{ text: "📋 Admin List", callback_data: "admin:admins:list" }],
      [{ text: "⬅️ Back to Panel", callback_data: "admin:main" }]
    ]
  };
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
}

async function renderPremiumMenu(ctx: any) {
  const text = `💎 <b>Premium Management</b>\n\nManage user premium plans.`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: "➕ Give Premium", callback_data: "admin:premium:give" },
        { text: "➖ Remove Premium", callback_data: "admin:premium:remove" }
      ],
      [{ text: "📋 Premium Users", callback_data: "admin:premium:list" }],
      [{ text: "⬅️ Back to Panel", callback_data: "admin:main" }]
    ]
  };
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
}

async function renderBanMenu(ctx: any) {
  const text = `🚫 <b>Ban System</b>\n\nRestrict users from using the bot.`;
  const keyboard = {
    inline_keyboard: [
      [
        { text: "🚫 Ban User", callback_data: "admin:ban:ban" },
        { text: "🔓 Unban User", callback_data: "admin:ban:unban" }
      ],
      [{ text: "📋 Banned Users", callback_data: "admin:ban:list" }],
      [{ text: "⬅️ Back to Panel", callback_data: "admin:main" }]
    ]
  };
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
}

async function renderBroadcastMenu(ctx: any) {
  const text = `📢 <b>Broadcast Center</b>\n\nSend messages to all users.`;
  const keyboard = {
    inline_keyboard: [
      [{ text: "💬 Start Broadcast", callback_data: "admin:broadcast:start" }],
      [{ text: "⬅️ Back to Panel", callback_data: "admin:main" }]
    ]
  };
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
}

async function renderSearchMenu(ctx: any) {
  const text = `🔍 <b>User Search</b>\n\nLook up user profiles by Telegram ID.`;
  const keyboard = {
    inline_keyboard: [
      [{ text: "🔍 Search by ID", callback_data: "admin:search:start" }],
      [{ text: "⬅️ Back to Panel", callback_data: "admin:main" }]
    ]
  };
  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
}

async function renderStatsMenu(ctx: any) {
  try {
    const stats = await getSystemStats();
    const text = 
      `📊 <b>Detailed Statistics</b>\n\n` +
      `👥 <b>Total Users:</b> ${stats.totalUsers}\n` +
      `💎 <b>Premium Users:</b> ${stats.premiumUsers}\n` +
      `🆓 <b>Free Users:</b> ${stats.freeUsers}\n\n` +
      `📸 <b>Scan Today:</b> ${stats.scanToday}\n` +
      `📊 <b>PPT Today:</b> ${stats.pptToday}\n` +
      `📄 <b>PDF Today:</b> ${stats.pdfToday}\n\n` +
      `👑 <b>Admin Count:</b> ${stats.adminCount}`;

    const keyboard = {
      inline_keyboard: [
        [{ text: "⬅️ Back to Panel", callback_data: "admin:main" }]
      ]
    };
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } catch (error) {
    console.error("renderStatsMenu error:", error);
  }
}

// CALLBACK ACTIONS
bot.action("admin:main", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderMainPanel(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:search", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderSearchMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:broadcast", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderBroadcastMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:admins", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderAdminsMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:premium", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderPremiumMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:ban", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderBanMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:stats", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderStatsMenu(ctx);
  await ctx.answerCbQuery();
});

// INPUT REQUESTS ACTIONS
bot.action("admin:search:start", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_search";
  await ctx.reply("🔍 Iltimos, qidiriladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:broadcast:start", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_broadcast";
  await ctx.reply("📢 Iltimos, barcha foydalanuvchilarga yuboriladigan xabarni kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:admins:add", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_add_admin";
  await ctx.reply("➕ Iltimos, admin qilib qo'shiladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:admins:remove", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_remove_admin";
  await ctx.reply("➖ Iltimos, admindan o'chiriladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:premium:give", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_give_premium";
  await ctx.reply("💎 Iltimos, premium beriladigan foydalanuvchi ID si va planini kiriting (Masalan: 12345678 MONTH):");
  await ctx.answerCbQuery();
});

bot.action("admin:premium:remove", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_remove_premium";
  await ctx.reply("💎 Iltimos, premium tarif o'chiriladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:ban:ban", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_ban";
  await ctx.reply("🚫 Iltimos, bloklanadigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:ban:unban", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  userState[ctx.from!.id] = "owner:waiting_for_unban";
  await ctx.reply("🔓 Iltimos, blokdan chiqariladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

// LIST HANDLERS
bot.action("admin:admins:list", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;

  try {
    const list = await getAdmins();
    const ownerId = 6630030492;
    
    let message = `👑 <b>Adminlar</b>\n\n`;
    message += `1. <code>${ownerId}</code> (OWNER)\n`;
    
    let idx = 2;
    for (const adminId of list) {
      if (adminId !== ownerId) {
        message += `${idx}. <code>${adminId}</code>\n`;
        idx++;
      }
    }
    
    message += `\nTotal:\n${idx - 1}`;
    
    await ctx.replyWithHTML(message);
  } catch (error) {
    console.error("Error listing admins:", error);
    await ctx.reply("❌ Adminlarni yuklashda xatolik yuz berdi.");
  }
  await ctx.answerCbQuery();
});

bot.action("admin:premium:list", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;

  try {
    const premiumUsers = await getPremiumUsers();

    if (premiumUsers.length === 0) {
      await ctx.reply("💎 Hozircha premium foydalanuvchilar yo'q.");
    } else {
      let message = `💎 <b>Premium Foydalanuvchilar</b>\n\n`;
      premiumUsers.forEach((u, i) => {
        const display = u.username ? `@${u.username}` : u.firstName;
        const until = u.premiumUntil
          ? u.premiumUntil.toLocaleDateString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit" })
          : "—";
        message += `${i + 1}. <b>${display}</b>\n   Plan: <code>${u.plan}</code>\n   Muddati: ${until}\n\n`;
      });
      message += `\n👥 <b>Jami:</b> ${premiumUsers.length}`;
      await ctx.replyWithHTML(message);
    }
  } catch (error) {
    console.error("premium:list error:", error);
    await ctx.reply("❌ Premium ro'yxatini yuklashda xatolik.");
  }

  await ctx.answerCbQuery();
});

bot.action("admin:ban:list", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await ctx.reply("🚫 <b>Bloklangan foydalanuvchilar:</b>\n\n(Hozircha faqat mock ro'yxat/integratsiya kutilmoqda)", { parse_mode: "HTML" });
  await ctx.answerCbQuery();
});

// INPUT STATE RECEIVER
bot.on("message", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId || !isOwner(userId)) {
    return next();
  }

  const state = userState[userId];
  if (!state || !state.startsWith("owner:")) {
    return next();
  }

  const text = (ctx.message as any).text || "";
  if (text.startsWith("/")) {
    delete userState[userId];
    return next();
  }

  // Clear state
  delete userState[userId];

  try {
    if (state === "owner:waiting_for_search") {
      const targetId = Number(text.trim());
      if (isNaN(targetId) || targetId <= 0) {
        await ctx.reply("❌ Noto'g'ri Telegram ID. Faqat raqam kiriting.");
      } else {
        const info = await getUserInfo(targetId);
        if (!info) {
          await ctx.replyWithHTML(`❌ Foydalanuvchi topilmadi.\n\n<code>${targetId}</code> ID li foydalanuvchi bazada mavjud emas.`);
        } else {
          const premiumStatus = info.premiumActive ? "✅ Active" : "❌ Inactive";
          const premiumUntil = info.premiumUntil
            ? info.premiumUntil.toLocaleDateString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit" })
            : "—";
          const username = info.username ? `@${info.username}` : "—";
          const createdAt = info.createdAt.toLocaleDateString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit" });

          const message =
            `🔍 <b>Foydalanuvchi profili</b>\n\n` +
            `🆔 <b>ID:</b> <code>${info.telegramId}</code>\n` +
            `👤 <b>Ism:</b> ${info.firstName}\n` +
            `📛 <b>Username:</b> ${username}\n\n` +
            `💎 <b>Plan:</b> ${info.plan}\n` +
            `⭐ <b>Premium:</b> ${premiumStatus}\n` +
            `📅 <b>Premium muddati:</b> ${premiumUntil}\n\n` +
            `📊 <b>Bugungi foydalanish:</b>\n` +
            `  📸 Scan: ${info.scanUsed}\n` +
            `  📊 PPT: ${info.pptUsed}\n` +
            `  📄 PDF: ${info.pdfUsed}\n\n` +
            `🗓 <b>Ro'yxatdan o'tgan:</b> ${createdAt}`;

          await ctx.replyWithHTML(message);
        }
      }
    } else if (state === "owner:waiting_for_broadcast") {
      if (!text || text.trim().length === 0) {
        await ctx.reply("❌ Xabar bo'sh bo'lishi mumkin emas.");
      } else {
        const broadcastMsg = text.trim();
        await ctx.reply("📢 Broadcast boshlanmoqda...");

        const userIds = await getAllUserIds();
        let delivered = 0;
        let failed = 0;

        for (const uid of userIds) {
          try {
            await bot.telegram.sendMessage(uid, broadcastMsg);
            delivered++;
          } catch {
            failed++;
          }
        }

        await ctx.replyWithHTML(
          `📢 <b>Broadcast yakunlandi</b>\n\n` +
          `✅ <b>Yetkazildi:</b> ${delivered}\n` +
          `❌ <b>Yuborilmadi:</b> ${failed}\n` +
          `👥 <b>Jami:</b> ${userIds.length}`
        );
      }
    } else if (state === "owner:waiting_for_add_admin") {
      const targetId = Number(text.trim());
      if (isNaN(targetId) || targetId <= 0) {
        await ctx.reply("❌ Noto'g'ri Telegram ID. Raqam kiriting.");
        return;
      }

      const targetUser = await getUser(targetId);
      if (!targetUser) {
        await ctx.replyWithHTML(`❌ <b>User not found</b>\n\nTelegram ID: <code>${targetId}</code>`);
        return;
      }

      const alreadyAdmin = await isAdmin(targetId);
      if (alreadyAdmin) {
        await ctx.replyWithHTML(`❌ Bu foydalanuvchi allaqachon admin`);
        return;
      }
      
      await addAdmin(targetId);
      await ctx.replyWithHTML(`✅ Admin qo'shildi\n\nTelegram ID:\n<code>${targetId}</code>`);
    } else if (state === "owner:waiting_for_remove_admin") {
      const targetId = Number(text.trim());
      if (isNaN(targetId) || targetId <= 0) {
        await ctx.reply("❌ Noto'g'ri Telegram ID. Raqam kiriting.");
        return;
      }

      const ownerId = 6630030492;
      if (targetId === ownerId) {
        await ctx.reply("❌ Owner o'chirilishi mumkin emas!");
        return;
      }

      const targetUser = await getUser(targetId);
      if (!targetUser) {
        await ctx.replyWithHTML(`❌ <b>User not found</b>\n\nTelegram ID: <code>${targetId}</code>`);
        return;
      }

      // Check if it's admin (OWNER is not in the admins table)
      const list = await getAdmins();
      if (!list.includes(targetId)) {
        await ctx.replyWithHTML(`❌ Bu foydalanuvchi admin emas`);
        return;
      }
      
      await removeAdmin(targetId);
      await ctx.replyWithHTML(`✅ Admin o'chirildi\n\nTelegram ID:\n<code>${targetId}</code>`);
    } else if (state === "owner:waiting_for_give_premium") {
      // Expected input: "TELEGRAM_ID PLAN" e.g. "6630030492 MONTH"
      const parts = text.trim().split(/\s+/);
      if (parts.length !== 2) {
        await ctx.reply("❌ Noto'g'ri format. Misol: <code>6630030492 MONTH</code>\nPlanlar: DAY | WEEK | MONTH | QUARTER | YEAR", { parse_mode: "HTML" });
      } else {
        const targetId = Number(parts[0]);
        const plan = parts[1].toUpperCase();
        if (isNaN(targetId) || targetId <= 0) {
          await ctx.reply("❌ Noto'g'ri Telegram ID. Faqat raqam kiriting.");
        } else if (!isValidPaidPlan(plan)) {
          await ctx.reply(`❌ Noto'g'ri plan: <code>${plan}</code>\nRuxsat etilgan planlar: DAY | WEEK | MONTH | QUARTER | YEAR`, { parse_mode: "HTML" });
        } else {
          const targetUser = await getUser(targetId);
          if (!targetUser) {
            await ctx.replyWithHTML(`❌ <b>User not found</b>\n\nTelegram ID: <code>${targetId}</code>`);
          } else {
            const premiumUntil = await givePremium(targetId, plan as any);
            const untilStr = premiumUntil.toLocaleDateString("uz-UZ", { year: "numeric", month: "2-digit", day: "2-digit" });
            await ctx.replyWithHTML(
              `✅ <b>Premium berildi</b>\n\n` +
              `👤 <b>User:</b> <code>${targetId}</code>\n` +
              `💎 <b>Plan:</b> ${plan}\n` +
              `📅 <b>Premium Until:</b> ${untilStr}`
            );
          }
        }
      }
    } else if (state === "owner:waiting_for_remove_premium") {
      const targetId = Number(text.trim());
      if (isNaN(targetId) || targetId <= 0) {
        await ctx.reply("❌ Noto'g'ri Telegram ID. Faqat raqam kiriting.");
      } else {
        const targetUser = await getUser(targetId);
        if (!targetUser) {
          await ctx.replyWithHTML(`❌ <b>User not found</b>\n\nTelegram ID: <code>${targetId}</code>`);
        } else {
          await removePremium(targetId);
          await ctx.replyWithHTML(
            `✅ <b>Premium olib tashlandi</b>\n\n` +
            `👤 <b>User:</b> <code>${targetId}</code>\n` +
            `💎 <b>Plan:</b> FREE`
          );
        }
      }
    } else if (state === "owner:waiting_for_ban") {
      const targetId = Number(text.trim());
      if (isNaN(targetId) || targetId <= 0) {
        await ctx.reply("❌ Noto'g'ri Telegram ID. Faqat raqam kiriting.");
      } else {
        const targetUser = await getUser(targetId);
        if (!targetUser) {
          await ctx.replyWithHTML(`❌ <b>User not found</b>\n\nTelegram ID: <code>${targetId}</code>`);
        } else {
          await banUser(targetId);
          await ctx.replyWithHTML(
            `✅ <b>Foydalanuvchi bloklandi</b>\n\n` +
            `👤 <b>User:</b> <code>${targetId}</code>`
          );
        }
      }
    } else if (state === "owner:waiting_for_unban") {
      const targetId = Number(text.trim());
      if (isNaN(targetId) || targetId <= 0) {
        await ctx.reply("❌ Noto'g'ri Telegram ID. Faqat raqam kiriting.");
      } else {
        const targetUser = await getUser(targetId);
        if (!targetUser) {
          await ctx.replyWithHTML(`❌ <b>User not found</b>\n\nTelegram ID: <code>${targetId}</code>`);
        } else {
          await unbanUser(targetId);
          await ctx.replyWithHTML(
            `✅ <b>Foydalanuvchi blokdan chiqarildi</b>\n\n` +
            `👤 <b>User:</b> <code>${targetId}</code>`
          );
        }
      }
    }
  } catch (err) {
    console.error("Owner message state receiver error:", err);
  }
});

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