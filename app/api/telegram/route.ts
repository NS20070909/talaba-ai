


import { Input } from "telegraf";
import { NextResponse } from "next/server";
import { isOwner, isAdmin, getSystemStats, getUserInfo, getAllUserIds, getPremiumUsers, getAdmins, addAdmin, removeAdmin, givePremium, removePremium, isValidPaidPlan, banUser, unbanUser, getBannedUsers } from "@/lib/admin";
import { getUser, createUser, getBotState, setBotState, deleteBotState } from "@/lib/storage";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://talaba-ai-chi.vercel.app";

import { getPaymentsStats, getRecentPayments, getPaymentById, updatePaymentStatus, getInboxPayments, getPaymentAnalytics, exportPaymentsCSV, searchPayments } from "@/lib/payment";
import { saveGroupChat, removeGroupChat, saveChannelChat, removeChannelChat, getBroadcastRecipients, createBroadcastRecord, getBroadcastHistory, getBroadcastById, executeBroadcast, retryFailedBroadcast, BroadcastTarget } from "@/lib/broadcast";
import { createTicket, addMessageToTicket, getTicketById, getTicketByNumber, getUserTickets, getAdminTickets, getTicketMessages, updateTicketStatus, updateTicketPriority, searchTickets, getSupportStats, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, TicketCategory, TicketPriority, TicketStatus } from "@/lib/support";
import { getFullUserProfile, getFilteredUsers, searchUsersV2, managePremiumV2, banUserV2, unbanUserV2, muteUserV2, unmuteUserV2, addUserNote, getUserNotes, getUserStatsV2, exportUsersCSV } from "@/lib/user-management";
import { isAdminActive, hasPermission, getAllAdminsV2, addAdminV2, removeAdminV2, updateAdminStatus, getAdminProfile, AdminRole } from "@/lib/admin-management";
import { getSystemSettings, updateSystemSetting } from "@/lib/settings";
import { getAuditLogs, recordAuditLog } from "@/lib/audit-log";
import { bot } from "@/lib/bot";
import { getSupabase } from "@/lib/supabase";

// Global Telegraf error handler for non-fatal Telegram API errors
bot.catch((err: any) => {
  const msg = String(err?.message || err?.description || err || "").toLowerCase();
  if (
    msg.includes("message is not modified") ||
    msg.includes("query is too old") ||
    msg.includes("response timeout expired")
  ) {
    return;
  }
  console.error("Telegraf bot error:", err);
});

// TELEGRAM FILE SEND
export async function sendFileToTelegram(
  userId: number,
  fileBuffer: Buffer,
  fileName: string
) {
  try {
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

// USER STATE IS STORED IN DATABASE (bot_states table)
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "talaba_ai_bot";

// START
bot.start(async (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    try {
      const existingUser = await getUser(userId);
      if (!existingUser) {
        await createUser(
          userId,
          ctx.from.first_name || "Telegram User",
          ctx.from.username || undefined,
          "FREE"
        );
      }
    } catch (err) {
      console.error("Error creating user on start:", err);
    }
  }

  const chatType = (ctx.chat?.type as string) || "private";
  if (chatType === "channel") return; // Do not send start menu in channels

  if (chatType === "group" || chatType === "supergroup") {
    await ctx.replyWithHTML(
      `📚 <b>Talaba AI Bot</b>\n\n` +
      `Ushbu bot shaxsiy chatda to'liq imkoniyatlar bilan ishlaydi.\n\n` +
      `👇 Botni ochish uchun quyidagi tugmani bosing:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Open Bot (Private Chat)", url: `https://t.me/${BOT_USERNAME}?start=open` }],
            [{ text: "✈️ Telegram Support", url: "https://t.me/Narkabilov_S_07" }]
          ]
        }
      }
    );
    return;
  }

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
              web_app: { url: `${APP_URL}` },
            },
          ],
          [
            {
              text: "📸 Bilet Scan",
              web_app: { url: `${APP_URL}?tab=scan&userId=${userId}` },
            },
          ],
        ],
      },
    }
  );
});

// TALABA AI
bot.command("talabaai", async (ctx) => {
  const chatType = (ctx.chat?.type as string) || "private";
  if (chatType === "channel") return;

  if (chatType === "group" || chatType === "supergroup") {
    await ctx.replyWithHTML(
      `🎓 <b>Talaba AI Assistant</b>\n\nMini App faqat shaxsiy muloqotda ochiladi. Botni ishga tushirish uchun pastdagi tugmani bosing 👇`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Open Talaba AI", url: `https://t.me/${BOT_USERNAME}?start=open` }]
          ]
        }
      }
    );
    return;
  }

  await ctx.reply(
    `🎓 Talaba AI\n\nAI Student Assistant 🚀\n\nMini App ni ochish uchun pastdagi tugmani bosing 👇`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Open Talaba AI", web_app: { url: `${APP_URL}` } }]
        ]
      }
    }
  );
});

// HELP
bot.command("help", async (ctx) => {
  await renderUserSupportMenu(ctx);
});

// SUPPORT
bot.command("support", async (ctx) => {
  await renderUserSupportMenu(ctx);
});

async function renderUserSupportMenu(ctx: any) {
  const chatType = (ctx.chat?.type as string) || "private";
  if (chatType === "channel") return;

  const text = `🆘 <b>Talaba AI — Yordam Markazi (Support Center V2)</b>\n\n` +
    `Muammo yoki taklifingiz bormi? Murojaat yuborish uchun pastdagi tugmalardan birini tanlang:`;

  const inlineKeyboard = chatType === "group" || chatType === "supergroup"
    ? [
        [{ text: "➕ Yangi Murojaat Yaratish", url: `https://t.me/${BOT_USERNAME}?start=support` }],
        [{ text: "🚀 Open Bot", url: `https://t.me/${BOT_USERNAME}?start=open` }]
      ]
    : [
        [{ text: "➕ Yangi Murojaat Yaratish", callback_data: "user:supp:new" }],
        [{ text: "📋 Mening Murojaatlarim", callback_data: "user:supp:my_tickets" }],
        [{ text: "🚀 Platformani ochish", web_app: { url: `${APP_URL}` } }]
      ];

  const keyboard = { inline_keyboard: inlineKeyboard };

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } else {
    await ctx.replyWithHTML(text, { reply_markup: keyboard });
  }
}

// ABOUT
bot.command("about", async (ctx) => {
  await ctx.replyWithHTML(
    `🎓 <b>Talaba AI</b>\n\n` +
    `🤖 <i>AI platform for students.</i>\n\n` +
    `⚡ <b>Texnologiyalar (Technology stack):</b>\n` +
    `• Gemini AI\n` +
    `• Next.js\n` +
    `• Supabase\n` +
    `• Vercel\n` +
    `• Telegram Bot\n\n` +
    `📁 <b>Versiya:</b> MVP v1.0`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📷 Instagram", url: "https://instagram.com/iits_nkb" },
            { text: "✈️ Telegram", url: "https://t.me/Narkabilov_S_07" }
          ]
        ]
      }
    }
  );
});

// PREMIUM
bot.command("premium", async (ctx) => {
  await ctx.replyWithHTML(
    `👑 <b>Talaba AI Premium Tariflari</b>\n\n` +
    `Ehtiyojingizga mos tarifni tanlang va barcha imkoniyatlardan to'liq foydalaning:\n\n` +
    `🟢 <b>Starter</b> — 2 900 so'm (1 kun)\n` +
    `🔵 <b>Weekly</b> — 11 900 so'm (7 kun)\n` +
    `🟣 <b>Premium ⭐</b> — 29 900 so'm (30 kun)\n\n` +
    `To'lov qilish va tariflarni ko'rish uchun /talabaai buyrug'ini bosing.`
  );
});

// SCAN
bot.command("scan", async (ctx) => {
  const userId = ctx.from.id;
  const chatType = (ctx.chat?.type as string) || "private";
  if (chatType === "channel") return;

  if (chatType === "group" || chatType === "supergroup") {
    await ctx.replyWithHTML(
      `📸 <b>Bilet Scan</b>\n\nBilet Scan faqat shaxsiy muloqotda ishlaydi. Botni ochish uchun pastdagi tugmani bosing 👇`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📸 Open Bilet Scan", url: `https://t.me/${BOT_USERNAME}?start=scan` }]
          ]
        }
      }
    );
    return;
  }

  await ctx.reply(
    `📸 Bilet Scan\n\nBilet Scan ochish uchun pastdagi tugmani bosing 👇`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📸 Open Bilet Scan", web_app: { url: `${APP_URL}?tab=scan&userId=${userId}` } }]
        ]
      }
    }
  );
});

// CHAT MEMBER & GROUP/CHANNEL TRACKER
bot.on("my_chat_member", async (ctx) => {
  try {
    const chat = ctx.chat;
    const newStatus = ctx.myChatMember?.new_chat_member?.status;
    const fromUser = ctx.myChatMember?.from;

    const addedBy = fromUser
      ? `${fromUser.first_name || ""} ${fromUser.last_name || ""} (${fromUser.username ? `@${fromUser.username}` : `ID: ${fromUser.id}`})`.trim()
      : "Noma'lum";

    const chatAny = chat as any;
    const usernameStr = chatAny.username ? `@${chatAny.username}` : "yo'q";
    const titleStr = chatAny.title || "Noma'lum Chat";

    if (chat.type === "group" || chat.type === "supergroup") {
      if (newStatus === "member" || newStatus === "administrator") {
        await saveGroupChat(chat.id, titleStr, chat.type);
        // Item 4: Notify Owner on new group addition
        const addMsg = `➕ <b>Bot yangi guruhga qo'shildi!</b>\n\n` +
          `📌 <b>Title:</b> ${titleStr}\n` +
          `🆔 <b>Chat ID:</b> <code>${chat.id}</code>\n` +
          `📛 <b>Username:</b> ${usernameStr}\n` +
          `👥 <b>Type:</b> ${chat.type}\n` +
          `👤 <b>Qo'shgan a'zo:</b> ${addedBy}`;
        await bot.telegram.sendMessage(6630030492, addMsg, { parse_mode: "HTML" });
      } else if (newStatus === "left" || newStatus === "kicked") {
        await removeGroupChat(chat.id);
        // Item 5: Notify Owner on group removal
        const removeMsg = `➖ <b>Bot guruhdan olib tashlandi</b>\n\n` +
          `📌 <b>Title:</b> ${titleStr}\n` +
          `🆔 <b>Chat ID:</b> <code>${chat.id}</code>\n` +
          `👥 <b>Type:</b> ${chat.type}`;
        await bot.telegram.sendMessage(6630030492, removeMsg, { parse_mode: "HTML" });
      }
    } else if (chat.type === "channel") {
      if (newStatus === "member" || newStatus === "administrator") {
        await saveChannelChat(chat.id, titleStr, chat.username);
        // Item 4: Notify Owner on new channel addition
        const addMsg = `➕ <b>Bot yangi kanalga qo'shildi!</b>\n\n` +
          `📌 <b>Title:</b> ${titleStr}\n` +
          `🆔 <b>Chat ID:</b> <code>${chat.id}</code>\n` +
          `📛 <b>Username:</b> ${usernameStr}\n` +
          `👥 <b>Type:</b> Channel\n` +
          `👤 <b>Qo'shgan a'zo:</b> ${addedBy}`;
        await bot.telegram.sendMessage(6630030492, addMsg, { parse_mode: "HTML" });
      } else if (newStatus === "left" || newStatus === "kicked") {
        await removeChannelChat(chat.id);
        // Item 5: Notify Owner on channel removal
        const removeMsg = `➖ <b>Bot kanaldan olib tashlandi</b>\n\n` +
          `📌 <b>Title:</b> ${titleStr}\n` +
          `🆔 <b>Chat ID:</b> <code>${chat.id}</code>\n` +
          `👥 <b>Type:</b> Channel`;
        await bot.telegram.sendMessage(6630030492, removeMsg, { parse_mode: "HTML" });
      }
    }
  } catch (err) {
    console.error("my_chat_member tracking error:", err);
  }
});

// PHOTO HANDLER
bot.on(
  "photo",
  async (ctx) => {
    const userId =
      ctx.from.id;

    const state = await getBotState(userId);
    if (
      state !==
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

      await deleteBotState(
        userId
      );
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

// OWNER / ADMIN PANEL COMMAND
bot.command("admin", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (!(await isAdmin(userId))) return;

  if (!(await isAdminActive(userId))) {
    await ctx.reply("❌ Ruxsat berilmagan. Admin hisobingiz nofaol (DISABLED) holatda.");
    return;
  }

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
      `📄 <b>PDF Today:</b> ${stats.pdfToday}\n` +
      `📝 <b>Referat Today:</b> ${stats.referatToday}\n` +
      `🌐 <b>Translation Today:</b> ${stats.translationToday}`;

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
        ],
        [
          { text: "👑 Premium Users", callback_data: "admin:premium:list" },
          { text: "💰 Payments", callback_data: "admin:payments" }
        ],
        [
          { text: "🎫 Support Center", callback_data: "admin:support" },
          { text: "👤 User Management V2", callback_data: "admin:users" }
        ],
        [
          { text: "⚙️ Settings V2", callback_data: "admin:settings" },
          { text: "📜 Audit Log V2", callback_data: "admin:audit" }
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

async function renderUserManagementMenu(ctx: any) {
  try {
    const stats = await getUserStatsV2();
    const text = `👤 <b>User Management System V2</b>\n\n` +
      `📊 <b>Foydalanuvchilar Statistikasi:</b>\n` +
      `• 👥 Jami foydalanuvchilar: <b>${stats.total_users}</b>\n` +
      `• ⚡ Faol (Active): ${stats.active_users}\n` +
      `• 💤 Inaktiv: ${stats.inactive_users}\n` +
      `• ⭐ Premium: ${stats.premium_users}\n` +
      `• 🆕 Bugun qo'shilgan: ${stats.new_users_today}\n` +
      `• 🚫 Banned: ${stats.banned_users}\n` +
      `• 🔇 Muted: ${stats.muted_users}\n\n` +
      `Boshqarish uchun bo'limni tanlang:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "👥 Barchasi", callback_data: "admin:usr:filter:ALL" },
          { text: "⭐ Premium", callback_data: "admin:usr:filter:PREMIUM" }
        ],
        [
          { text: "🚫 Banned", callback_data: "admin:usr:filter:BANNED" },
          { text: "🔇 Muted", callback_data: "admin:usr:filter:MUTED" }
        ],
        [
          { text: "🔍 Qidirish", callback_data: "admin:usr:search_input" },
          { text: "📥 Export CSV", callback_data: "admin:usr:export_csv" }
        ],
        [
          { text: "⬅️ Back to Panel", callback_data: "admin:main" }
        ]
      ]
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
    } else {
      await ctx.replyWithHTML(text, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("renderUserManagementMenu error:", err);
    await ctx.reply("❌ User Management menyusini yuklashda xatolik");
  }
}

async function renderAdminSupportMenu(ctx: any) {
  try {
    const stats = await getSupportStats();
    const text = `🎫 <b>Support Center V2 (Admin Panel)</b>\n\n` +
      `📊 <b>Statistika:</b>\n` +
      `• 📬 Open: ${stats.open}\n` +
      `• ⏳ In Progress: ${stats.in_progress}\n` +
      `• ⌛ Waiting User: ${stats.waiting_user}\n` +
      `• ✅ Resolved: ${stats.resolved}\n` +
      `• 🔒 Closed: ${stats.closed}\n` +
      `• ⚡ O'rtacha javob vaqti: ${stats.avg_response_minutes} min\n\n` +
      `Ko'rish uchun statusni tanlang:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: `📬 Open (${stats.open})`, callback_data: "admin:supp:list:OPEN" },
          { text: `⏳ In Progress (${stats.in_progress})`, callback_data: "admin:supp:list:IN_PROGRESS" }
        ],
        [
          { text: `⌛ Waiting User (${stats.waiting_user})`, callback_data: "admin:supp:list:WAITING_USER" },
          { text: `✅ Resolved (${stats.resolved})`, callback_data: "admin:supp:list:RESOLVED" }
        ],
        [
          { text: `🔍 Qidirish`, callback_data: "admin:supp:search_input" },
          { text: `📊 Full Stats`, callback_data: "admin:supp:stats_view" }
        ],
        [
          { text: "⬅️ Back to Panel", callback_data: "admin:main" }
        ]
      ]
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
    } else {
      await ctx.replyWithHTML(text, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("renderAdminSupportMenu error:", err);
    await ctx.reply("❌ Support menyusini yuklashda xatolik");
  }
}

// SUBMENU RENDERERS
async function renderAdminsMenu(ctx: any) {
  try {
    const admins = await getAllAdminsV2();
    let text = `👑 <b>Admin Management System V2</b>\n\n`;
    text += `📊 <b>Jami Adminlar:</b> ${admins.length} ta\n\n`;

    admins.forEach((a, idx) => {
      const statusBadge = a.status === "ACTIVE" ? "🟢 ACTIVE" : "🔴 DISABLED";
      const roleBadge = a.role === "OWNER" ? "👑 OWNER" : a.role === "ADMIN" ? "🛡 ADMIN" : "👤 MODERATOR";
      const usernameStr = a.username ? `@${a.username}` : "yo'q";
      const dateStr = new Date(a.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

      text += `${idx + 1}. <b>${a.name || "Admin"}</b> (${roleBadge} | ${statusBadge})\n`;
      text += `🆔 ID: <code>${a.telegram_id}</code> | 📛 User: ${usernameStr}\n`;
      text += `📅 Qo'shilgan: ${dateStr}\n\n`;
    });

    const keyboard = {
      inline_keyboard: [
        [
          { text: "➕ Add Admin", callback_data: "admin:adm:add_input" },
          { text: "🗑 Remove Admin", callback_data: "admin:adm:remove_input" }
        ],
        [
          { text: "🔴 Disable Admin", callback_data: "admin:adm:disable_input" },
          { text: "🟢 Enable Admin", callback_data: "admin:adm:enable_input" }
        ],
        [
          { text: "⬅️ Back to Panel", callback_data: "admin:main" }
        ]
      ]
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
    } else {
      await ctx.replyWithHTML(text, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("renderAdminsMenu error:", err);
    await ctx.reply("❌ Adminlar menyusini yuklashda xatolik.");
  }
}

async function renderSettingsMenu(ctx: any) {
  try {
    const settings = await getSystemSettings();
    let text = `⚙️ <b>Settings Management Panel</b>\n\n`;

    text += `💳 <b>Karta Egasi:</b> ${settings.card_holder || "Sirojiddin Narkabilov"}\n`;
    text += `💳 <b>Karta Raqami:</b> <code>${settings.card_number || "8600 0000 0000 0000"}</code>\n`;
    text += `🛠 <b>Maintenance Mode:</b> ${settings.maintenance_mode ? "🔴 YOQILGAN" : "🟢 O'CHIRILGAN"}\n\n`;
    text += `Boshqarish uchun pastdagi tugmalardan foydalaning:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "💳 Edit Card Holder", callback_data: "admin:sett:edit_holder" },
          { text: "💳 Edit Card Number", callback_data: "admin:sett:edit_card" }
        ],
        [
          { text: "🛠 Maintenance Toggle", callback_data: "admin:sett:toggle_maint" }
        ],
        [
          { text: "⬅️ Back to Panel", callback_data: "admin:main" }
        ]
      ]
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
    } else {
      await ctx.replyWithHTML(text, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("renderSettingsMenu error:", err);
    await ctx.reply("❌ Settings menyusini yuklashda xatolik.");
  }
}

async function renderAuditLogMenu(ctx: any) {
  try {
    const { logs, total } = await getAuditLogs({ limit: 15 });
    let text = `📜 <b>Audit Log V2 (Oxirgi ${logs.length} / ${total} ta harakat):</b>\n\n`;

    if (logs.length === 0) {
      text += `<i>Hozircha audit loglar yo'q.</i>\n`;
    } else {
      logs.forEach((l, idx) => {
        const dateStr = new Date(l.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
        text += `${idx + 1}. ⚡ <b>${l.action}</b> by ${l.admin_name || `ID:${l.admin_id}`}\n`;
        text += `🎯 Target: ${l.target || "—"} | 📅 ${dateStr}\n`;
        text += `📝 ${l.description}\n\n`;
      });
    }

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔍 Audit Log Qidirish", callback_data: "admin:audit:search_input" },
          { text: "📥 Export CSV", callback_data: "admin:audit:export_csv" }
        ],
        [{ text: "⬅️ Back to Panel", callback_data: "admin:main" }]
      ]
    };

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
    } else {
      await ctx.replyWithHTML(text, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("renderAuditLogMenu error:", err);
    await ctx.reply("❌ Audit Log menyusini yuklashda xatolik.");
  }
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
  const text = `📢 <b>Broadcast Center V2</b>\n\n` +
    `Xabarni kimlarga yubormoqchisiz? Maqsadli auditoriyani tanlang:\n\n` +
    `👤 <b>Users</b> — Barcha foydalanuvchilar\n` +
    `💎 <b>Premium Users</b> — Faqat Premium foydalanuvchilar\n` +
    `👥 <b>Groups</b> — Bot qo'shilgan guruhlar\n` +
    `📣 <b>Channels</b> — Bot qo'shilgan kanallar\n` +
    `🌍 <b>Everyone</b> — Barcha manbalarga (Users + Groups + Channels)`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "👤 Users", callback_data: "admin:bc:target:USERS" },
        { text: "💎 Premium", callback_data: "admin:bc:target:PREMIUM" }
      ],
      [
        { text: "👥 Groups", callback_data: "admin:bc:target:GROUPS" },
        { text: "📣 Channels", callback_data: "admin:bc:target:CHANNELS" }
      ],
      [
        { text: "🌍 Everyone (Barchasi)", callback_data: "admin:bc:target:EVERYONE" }
      ],
      [
        { text: "📋 Broadcast History & Retry", callback_data: "admin:bc:history" },
        { text: "⬅️ Back to Panel", callback_data: "admin:main" }
      ]
    ]
  };
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  } else {
    await ctx.replyWithHTML(text, { reply_markup: keyboard });
  }
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
      `📄 <b>PDF Today:</b> ${stats.pdfToday}\n` +
      `📝 <b>Referat Today:</b> ${stats.referatToday}\n` +
      `🌐 <b>Translation Today:</b> ${stats.translationToday}\n\n` +
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

async function renderPaymentsMenu(ctx: any) {
  try {
    const stats = await getPaymentsStats();
    const inbox = await getInboxPayments(50);

    let text = `💰 <b>Payment Inbox (Faqat ko'rib chiqilishi kerak bo'lganlar)</b>\n\n`;
    text += `📈 <b>Statistika:</b>\n`;
    text += `⏳ Pending: ${stats.pending}\n`;
    text += `📸 Proof Uploaded: ${stats.proof_uploaded}\n`;
    text += `✅ Paid: ${stats.paid}\n`;
    text += `❌ Failed: ${stats.failed}\n`;
    text += `⏰ Expired: ${stats.expired}\n`;
    text += `💵 Total Revenue: ${stats.total_revenue.toLocaleString("uz-UZ")} UZS\n\n`;

    text += `📥 <b>Inbox (${inbox.length} ta kutilayotgan to'lov):</b>\n\n`;
    const keyboard = {
      inline_keyboard: [] as any[]
    };

    if (inbox.length === 0) {
      text += `<i>Hozircha kutilayotgan to'lovlar yo'q. Allaqachon tasdiqlangan va rad etilganlar Inbox dan o'chiriladi.</i>\n`;
    } else {
      for (let i = 0; i < inbox.length; i++) {
        const p = inbox[i];
        const date = new Date(p.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
        const user = await getUser(p.telegram_id);
        const firstName = user?.firstName || "Unknown";
        const username = user?.username ? `@${user.username}` : "yo'q";
        const proofDate = p.proof_uploaded_at ? new Date(p.proof_uploaded_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }) : "yo'q";

        text += `${i + 1}. <b>${p.plan}</b> - ${p.amount.toLocaleString("uz-UZ")} UZS\n`;
        text += `👤 Ism: ${firstName}\n📛 Username: ${username}\n🆔 Telegram ID: <code>${p.telegram_id}</code>\n`;
        text += `📦 Tarif: ${p.plan}\n💵 Summa: ${p.amount.toLocaleString("uz-UZ")} UZS\n`;
        text += `📅 Yaratilgan: ${date}\n📸 Chek yuklangan: ${proofDate}\n📊 Status: <b>${p.status}</b>\n\n`;

        const row: any[] = [];
        if (p.proof_url) {
          row.push({ text: `📸 View Proof #${i + 1}`, callback_data: `admin:pay:view:${p.id}` });
        }
        row.push({ text: `✅ Confirm #${i + 1}`, callback_data: `admin:pay:confirm:${p.id}` });
        row.push({ text: `❌ Reject #${i + 1}`, callback_data: `admin:pay:reject:${p.id}` });
        
        keyboard.inline_keyboard.push(row);
      }
    }

    keyboard.inline_keyboard.push([
      { text: "📜 Payment History", callback_data: "admin:pay:history_view" },
      { text: "🔍 Payment Qidirish", callback_data: "admin:pay:search_input" }
    ]);
    keyboard.inline_keyboard.push([
      { text: "📊 Analytics", callback_data: "admin:pay:analytics_view" },
      { text: "📥 Export CSV", callback_data: "admin:pay:export_csv" }
    ]);
    keyboard.inline_keyboard.push([
      { text: "⬅️ Back to Panel", callback_data: "admin:main" }
    ]);

    const cbMessage = ctx.callbackQuery?.message as any;
    if (cbMessage?.text && cbMessage.text.includes("Payment Inbox")) {
      await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
    } else {
      if (ctx.callbackQuery) {
        await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
      } else {
        await ctx.replyWithHTML(text, { reply_markup: keyboard });
      }
    }
  } catch (error) {
    console.error("renderPaymentsMenu error:", error);
    await ctx.reply("❌ Xatolik yuz berdi");
  }
}

// CALLBACK ACTIONS
bot.action("admin:main", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderMainPanel(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:pay:history_view", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  try {
    const history = await getRecentPayments(25);
    if (history.length === 0) {
      await ctx.reply("📜 Hozircha to'lovlar tarixi mavjud emas.");
    } else {
      let msg = `📜 <b>Payment History (Oxirgi ${history.length} ta to'lov):</b>\n\n`;
      const keyboard = { inline_keyboard: [] as any[] };

      for (let i = 0; i < history.length; i++) {
        const p = history[i];
        const user = await getUser(p.telegram_id);
        const firstName = user?.firstName || "Unknown";
        const date = new Date(p.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

        msg += `${i + 1}. <b>${p.plan}</b> - ${p.amount.toLocaleString("uz-UZ")} UZS\n`;
        msg += `👤 User: ${firstName} (<code>${p.telegram_id}</code>)\n`;
        msg += `📊 Status: <b>${p.status}</b> | 📅 ${date}\n\n`;

        if (p.proof_url) {
          keyboard.inline_keyboard.push([
            { text: `📸 View Proof #${i + 1}`, callback_data: `admin:pay:view:${p.id}` }
          ]);
        }
      }

      keyboard.inline_keyboard.push([{ text: "⬅️ Payments Menu ga qaytish", callback_data: "admin:payments" }]);
      await ctx.replyWithHTML(msg, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("Payment history error:", err);
    await ctx.reply("❌ To'lovlar tarixini yuklashda xatolik.");
  }
  await ctx.answerCbQuery();
});

bot.action("admin:search", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderSearchMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:admins", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!(await isAdmin(userId)) || !(await isAdminActive(userId))) return;
  await renderAdminsMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:adm:add_input", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner admin qo'sha oladi!", { show_alert: true });
    return;
  }
  await setBotState(userId, "owner:waiting_for_add_admin_id");
  await ctx.replyWithHTML("➕ <b>Yangi Admin Qo'shish</b>\n\nIltimos, yangi adminning Telegram ID sini kiriting (masalan: <code>123456789</code>):");
  await ctx.answerCbQuery();
});

bot.action("admin:adm:remove_input", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner admin o'chira oladi!", { show_alert: true });
    return;
  }
  await setBotState(userId, "owner:waiting_for_remove_admin_id");
  await ctx.replyWithHTML("🗑 <b>Admin O'chirish</b>\n\nIltimos, o'chirilishi kerak bo'lgan adminning Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:adm:disable_input", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner admin holatini o'zgartira oladi!", { show_alert: true });
    return;
  }
  await setBotState(userId, "owner:waiting_for_disable_admin_id");
  await ctx.replyWithHTML("🔴 <b>Adminni Nofaol Qilish (Disable)</b>\n\nIltimos, nofaol qilinadigan adminning Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:adm:enable_input", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner admin holatini o'zgartira oladi!", { show_alert: true });
    return;
  }
  await setBotState(userId, "owner:waiting_for_enable_admin_id");
  await ctx.replyWithHTML("🟢 <b>Adminni Faollashtirish (Enable)</b>\n\nIltimos, faollashtiriladigan adminning Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:settings", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner tizim sozlamalariga kirishi mumkin!", { show_alert: true });
    return;
  }
  await renderSettingsMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:sett:toggle_maint", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner sozlamalarni o'zgartira oladi!", { show_alert: true });
    return;
  }
  try {
    const currentSettings = await getSystemSettings("bot");
    const newStatus = !currentSettings.maintenance_mode;
    await updateSystemSetting("maintenance_mode", newStatus, "bot", userId);
    await recordAuditLog({
      adminId: userId,
      action: "SETTINGS_UPDATED",
      target: "maintenance_mode",
      description: `Maintenance mode toggled to ${newStatus}`,
    });
    await ctx.answerCbQuery(`✅ Maintenance mode: ${newStatus ? "YOQILDI" : "O'CHIRILDI"}`, { show_alert: true });
    await renderSettingsMenu(ctx);
  } catch (err) {
    console.error("toggle_maint error:", err);
    await ctx.answerCbQuery("❌ Xatolik yuz berdi.");
  }
});

bot.action("admin:sett:edit_card", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner karta raqamini o'zgartirishi mumkin!", { show_alert: true });
    return;
  }
  await setBotState(userId, "owner:waiting_for_edit_card");
  await ctx.replyWithHTML("💳 <b>Karta Raqamini O'zgartirish</b>\n\nYangi karta raqamini kiriting (masalan: <code>8600 1234 5678 9012</code>):");
  await ctx.answerCbQuery();
});

bot.action("admin:sett:edit_holder", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner karta egasi ismini o'zgartirishi mumkin!", { show_alert: true });
    return;
  }
  await setBotState(userId, "owner:waiting_for_edit_holder");
  await ctx.replyWithHTML("💳 <b>Karta Egasini O'zgartirish</b>\n\nYangi karta egasining Ismi va Familiyasini kiriting (masalan: <code>Sirojiddin Narkabilov</code>):");
  await ctx.answerCbQuery();
});

bot.action("admin:audit", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!(await hasPermission(userId, "audit_log"))) {
    await ctx.answerCbQuery("❌ Audit Log ni ko'rish ruxsati yo'q!", { show_alert: true });
    return;
  }
  await renderAuditLogMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:audit:search_input", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!(await hasPermission(userId, "audit_log"))) return;
  await setBotState(userId, "owner:waiting_for_audit_search");
  await ctx.reply("🔍 Audit Log dan qidirish uchun kalit so'z yoki action nomini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:audit:export_csv", async (ctx) => {
  const userId = ctx.from?.id || 0;
  if (!isOwner(userId)) {
    await ctx.answerCbQuery("❌ Faqat Owner audit loglarini eksport qila oladi!", { show_alert: true });
    return;
  }
  try {
    const { exportAuditLogsCSV } = await import("@/lib/audit-log");
    const csv = await exportAuditLogsCSV();
    const buffer = Buffer.from(csv, "utf-8");
    await ctx.replyWithDocument(Input.fromBuffer(buffer, `audit_logs_${Date.now()}.csv`), {
      caption: "📥 <b>Audit Log V2 Eksport Fayli (CSV)</b>",
      parse_mode: "HTML",
    });
    await ctx.answerCbQuery();
  } catch (err) {
    console.error("Export audit CSV error:", err);
    await ctx.reply("❌ Audit log eksportida xatolik.");
  }
});

bot.action("admin:broadcast", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderBroadcastMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action(/admin:bc:target:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const target = ctx.match[1] as BroadcastTarget;
  await setBotState(ctx.from!.id, `owner:waiting_for_bc_${target}`);

  const recipients = await getBroadcastRecipients(target);
  await ctx.replyWithHTML(
    `📢 <b>${target}</b> uchun xabar yuborish\n\n` +
    `📊 <b>Target auditoriya soni:</b> ${recipients.length} ta recipient\n\n` +
    `Iltimos, yubormoqchi bo'lgan xabaringizni kiriting (HTML formatini qo'llab-quvvatlaydi):`
  );
  await ctx.answerCbQuery();
});

bot.action("admin:bc:history", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  try {
    const history = await getBroadcastHistory(15);
    if (history.length === 0) {
      await ctx.reply("📋 Hozircha Broadcast tarixi yo'q.");
    } else {
      let msg = `📋 <b>Broadcast History & Stats (${history.length} ta):</b>\n\n`;
      const keyboard = { inline_keyboard: [] as any[] };

      history.forEach((bc, idx) => {
        const total = bc.total_recipients || 0;
        const rate = total > 0 ? Math.round((bc.delivered_count / total) * 100) : 0;
        const dateStr = bc.created_at ? new Date(bc.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" }) : "—";

        msg += `${idx + 1}. 🎯 <b>Target:</b> ${bc.target_type} | 📊 <b>Status:</b> ${bc.status}\n`;
        msg += `👥 Audience: ${total} | ✅ Success: ${bc.delivered_count} (${rate}%) | ❌ Failed: ${bc.failed_count}\n`;
        msg += `📅 Vaqt: ${dateStr}\n\n`;

        if (bc.failed_count > 0) {
          keyboard.inline_keyboard.push([
            { text: `🔄 Retry Failed #${idx + 1} (${bc.failed_count} ta)`, callback_data: `admin:bc:retry:${bc.id}` }
          ]);
        }
      });

      keyboard.inline_keyboard.push([{ text: "⬅️ Broadcast Menu ga qaytish", callback_data: "admin:broadcast" }]);
      await ctx.replyWithHTML(msg, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("Broadcast history error:", err);
    await ctx.reply("❌ History yuklashda xatolik");
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:bc:confirm:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const broadcastId = ctx.match[1];
  try {
    await ctx.reply("📢 Broadcast yuborilmoqda...");
    const result = await executeBroadcast(broadcastId);
    const total = result.total_recipients || 0;
    const rate = total > 0 ? Math.round((result.delivered_count / total) * 100) : 0;

    await ctx.replyWithHTML(
      `📢 <b>Broadcast yakunlandi!</b>\n\n` +
      `🎯 <b>Target:</b> ${result.target_type}\n` +
      `👥 <b>Recipients:</b> ${result.total_recipients}\n` +
      `✅ <b>Delivered:</b> ${result.delivered_count} (${rate}%)\n` +
      `❌ <b>Failed:</b> ${result.failed_count}`,
      {
        reply_markup: result.failed_count > 0 ? {
          inline_keyboard: [
            [{ text: `🔄 Omadsizlarga qayta yuborish (${result.failed_count} ta)`, callback_data: `admin:bc:retry:${result.id}` }]
          ]
        } : undefined
      }
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Broadcast yuborishda xatolik yuz berdi.");
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:bc:schedule:1h:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const broadcastId = ctx.match[1];
  try {
    const supabase = getSupabase();
    const scheduledTime = new Date(Date.now() + 3600 * 1000).toISOString();
    await supabase.from("broadcasts").update({ status: "scheduled", scheduled_at: scheduledTime }).eq("id", broadcastId);

    await ctx.replyWithHTML(
      `⏰ <b>Broadcast 1 soatdan keyinga rejalashtirildi!</b>\n\n` +
      `📅 Rejalashtirilgan vaqt: ${new Date(scheduledTime).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}`
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Rejalashtirishda xatolik.");
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:bc:cancel:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await ctx.reply("❌ Broadcast bekor qilindi.");
  await ctx.answerCbQuery();
});

// ─────────────────────────────────────────────────────────────────────────────
// USER SUPPORT CALLBACKS
// ─────────────────────────────────────────────────────────────────────────────

bot.action("user:supp:new", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    const profile = await getFullUserProfile(userId);
    if (profile?.is_muted) {
      await ctx.answerCbQuery("🔇 Hisobingiz vaqtincha cheklangan (Muted). Murojaat yarata olmaysiz.", { show_alert: true });
      return;
    }
  }

  const text = `📁 <b>Murojaat kategoriyasini tanlang:</b>\n\n` +
    `Ehtiyojingizga mos bo'limni tanlang:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "💳 Payment", callback_data: "user:supp:cat:PAYMENT" },
        { text: "⭐ Premium", callback_data: "user:supp:cat:PREMIUM" }
      ],
      [
        { text: "🤖 AI Problems", callback_data: "user:supp:cat:AI_PROBLEMS" },
        { text: "⚙ Technical Problem", callback_data: "user:supp:cat:TECHNICAL" }
      ],
      [
        { text: "🐞 Bug Report", callback_data: "user:supp:cat:BUG_REPORT" },
        { text: "💡 Suggestion", callback_data: "user:supp:cat:SUGGESTION" }
      ],
      [
        { text: "📦 Other", callback_data: "user:supp:cat:OTHER" }
      ],
      [
        { text: "⬅️ Yordam menyusiga qaytish", callback_data: "user:supp:menu" }
      ]
    ]
  };

  await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: keyboard });
  await ctx.answerCbQuery();
});

bot.action("user:supp:menu", async (ctx) => {
  await renderUserSupportMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action(/user:supp:cat:(.+)/, async (ctx) => {
  const category = ctx.match[1] as TicketCategory;
  await setBotState(ctx.from!.id, `user:waiting_for_supp_msg_${category}`);

  const catLabel = CATEGORY_LABELS[category] || category;
  await ctx.replyWithHTML(
    `📁 Kategoriya: <b>${catLabel}</b>\n\n` +
    `Iltimos, murojaatingiz matnini batafsil yozing.\n` +
    `<i>(Rasm yoki hujjat biriktirmoqchi bo'lsangiz, uni rasm/fayl ko'rinishida yuborishingiz mumkin)</i>`
  );
  await ctx.answerCbQuery();
});

bot.action("user:supp:my_tickets", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    const tickets = await getUserTickets(userId);
    if (tickets.length === 0) {
      await ctx.replyWithHTML(`📋 Sizda hozircha murojaatlar yo'q.`);
    } else {
      let msg = `📋 <b>Sizning murojaatlaringiz (${tickets.length} ta):</b>\n\n`;
      const keyboard = { inline_keyboard: [] as any[] };

      for (let i = 0; i < Math.min(tickets.length, 10); i++) {
        const t = tickets[i];
        const catLabel = CATEGORY_LABELS[t.category] || t.category;
        const statLabel = STATUS_LABELS[t.status] || t.status;
        const dateStr = new Date(t.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

        msg += `${i + 1}. 🎫 <b>Ticket #${t.ticket_number}</b>\n`;
        msg += `📁 Kategoriya: ${catLabel}\n`;
        msg += `📊 Status: <b>${statLabel}</b> | 📅 ${dateStr}\n`;
        msg += `💬 <b>Subject:</b> ${t.subject || "—"}\n\n`;

        if (t.status !== "CLOSED") {
          keyboard.inline_keyboard.push([
            { text: `💬 Javob yozish (#${t.ticket_number})`, callback_data: `user:supp:reply:${t.id}` }
          ]);
        }
      }

      keyboard.inline_keyboard.push([{ text: "⬅️ Yordam menyusiga qaytish", callback_data: "user:supp:menu" }]);
      await ctx.replyWithHTML(msg, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("getUserTickets error:", err);
    await ctx.reply("❌ Murojaatlarni yuklashda xatolik.");
  }
  await ctx.answerCbQuery();
});

bot.action(/user:supp:reply:(.+)/, async (ctx) => {
  const ticketId = ctx.match[1];
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    await ctx.answerCbQuery("❌ Murojaat topilmadi", { show_alert: true });
    return;
  }

  await setBotState(ctx.from!.id, `user:waiting_for_supp_reply_${ticketId}`);
  await ctx.replyWithHTML(`💬 <b>Ticket #${ticket.ticket_number}</b> ga javobingizni kiriting:`);
  await ctx.answerCbQuery();
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SUPPORT CALLBACKS
// ─────────────────────────────────────────────────────────────────────────────

bot.action("admin:support", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderAdminSupportMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action(/admin:supp:list:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const status = ctx.match[1] as TicketStatus;

  try {
    const tickets = await getAdminTickets(status);
    if (tickets.length === 0) {
      await ctx.replyWithHTML(`📋 <b>${status}</b> statusli murojaatlar yo'q.`);
    } else {
      let msg = `🎫 <b>Support Tickets (${status}):</b>\n\n`;
      const keyboard = { inline_keyboard: [] as any[] };

      for (let i = 0; i < Math.min(tickets.length, 10); i++) {
        const t = tickets[i];
        const user = await getUser(t.telegram_id);
        const firstName = user?.firstName || "Unknown";
        const catLabel = CATEGORY_LABELS[t.category] || t.category;
        const prioLabel = PRIORITY_LABELS[t.priority] || t.priority;
        const dateStr = new Date(t.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

        msg += `${i + 1}. 🎫 <b>Ticket #${t.ticket_number}</b>\n`;
        msg += `👤 User: ${firstName} (<code>${t.telegram_id}</code>)\n`;
        msg += `📁 Kategoriya: ${catLabel} | 🚩 Prioritet: ${prioLabel}\n`;
        msg += `📅 Vaqt: ${dateStr}\n`;
        msg += `💬 Subject: ${t.subject || "—"}\n\n`;

        keyboard.inline_keyboard.push([
          { text: `💬 Javob #${t.ticket_number}`, callback_data: `admin:supp:reply:${t.id}` },
          { text: `⏳ Progress`, callback_data: `ad:sp:st:${t.id}:IP` },
          { text: `🔒 Close`, callback_data: `ad:sp:st:${t.id}:CL` }
        ]);
      }

      keyboard.inline_keyboard.push([{ text: "⬅️ Support Menu ga qaytish", callback_data: "admin:support" }]);
      await ctx.replyWithHTML(msg, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error("Admin ticket list error:", err);
    await ctx.reply("❌ Xatolik yuz berdi.");
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:supp:reply:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const ticketId = ctx.match[1];
  const ticket = await getTicketById(ticketId);
  if (!ticket) {
    await ctx.answerCbQuery("❌ Ticket topilmadi", { show_alert: true });
    return;
  }

  await setBotState(ctx.from!.id, `owner:waiting_for_supp_reply_${ticketId}`);
  await ctx.replyWithHTML(`💬 <b>Ticket #${ticket.ticket_number}</b> uchun foydalanuvchiga yuboriladigan javobingizni kiriting:`);
  await ctx.answerCbQuery();
});

bot.action(/ad:sp:st:(.+):(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const ticketId = ctx.match[1];
  const shortCode = ctx.match[2];

  const statusMap: Record<string, TicketStatus> = {
    IP: "IN_PROGRESS",
    CL: "CLOSED",
    OP: "OPEN",
    WU: "WAITING_USER",
    RS: "RESOLVED",
  };
  const status = statusMap[shortCode] || (shortCode as TicketStatus);

  try {
    const updated = await updateTicketStatus(ticketId, status);
    if (updated) {
      await ctx.answerCbQuery(`✅ Status updated to ${status}`, { show_alert: true });
      try {
        await bot.telegram.sendMessage(
          updated.telegram_id,
          `ℹ️ <b>Murojaatingiz holati o'zgardi (#${updated.ticket_number})</b>\n\nYangi status: <b>${STATUS_LABELS[updated.status] || updated.status}</b>`,
          { parse_mode: "HTML" }
        );
      } catch (notifyErr) {
        console.error("User status change notify error:", notifyErr);
      }
    }
  } catch (err) {
    console.error(err);
    await ctx.answerCbQuery("❌ Statusni o'zgartirishda xatolik.");
  }
});

bot.action("admin:supp:search_input", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_supp_search");
  await ctx.reply("🔍 Support Ticket qidirish uchun parametr kiriting:\n(Ticket #1001, Telegram ID, Username, Category, Priority yoki Status)");
  await ctx.answerCbQuery();
});

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT CALLBACKS
// ─────────────────────────────────────────────────────────────────────────────

bot.action("admin:users", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderUserManagementMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:filter:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const filter = ctx.match[1];
  try {
    const { users, total } = await getFilteredUsers(filter, 10, 0);
    if (users.length === 0) {
      await ctx.replyWithHTML(`📋 <b>${filter}</b> filtriga mos foydalanuvchilar topilmadi.`);
    } else {
      let msg = `👤 <b>Foydalanuvchilar Ro'yxati (${filter} - Total: ${total}):</b>\n\n`;
      const keyboard = { inline_keyboard: [] as any[] };

      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        const usernameStr = u.username ? `@${u.username}` : "—";
        const banStr = u.is_banned ? "🚫 BANNED" : u.is_muted ? "🔇 MUTED" : "✅ ACTIVE";

        msg += `${i + 1}. <b>${u.first_name}</b> (${usernameStr})\n`;
        msg += `🆔 ID: <code>${u.telegram_id}</code> | Plan: <b>${u.plan}</b> | ${banStr}\n\n`;

        keyboard.inline_keyboard.push([
          { text: `👤 Profile (#${i + 1})`, callback_data: `admin:usr:profile:${u.telegram_id}` }
        ]);
      }

      keyboard.inline_keyboard.push([{ text: "⬅️ User Management Menu", callback_data: "admin:users" }]);
      await ctx.replyWithHTML(msg, { reply_markup: keyboard });
    }
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Ro'yxatni yuklashda xatolik.");
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:profile:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  try {
    const p = await getFullUserProfile(targetId);
    if (!p) {
      await ctx.reply("❌ Foydalanuvchi topilmadi.");
      await ctx.answerCbQuery();
      return;
    }

    const notes = await getUserNotes(targetId);
    const usernameStr = p.username ? `@${p.username}` : "yo'q";
    const untilStr = p.premium_until ? new Date(p.premium_until).toLocaleDateString("uz-UZ") : "—";
    const regStr = new Date(p.created_at).toLocaleDateString("uz-UZ");

    let msg = `👤 <b>Foydalanuvchi Profili V2</b>\n\n` +
      `🆔 <b>Telegram ID:</b> <code>${p.telegram_id}</code>\n` +
      `👤 <b>Ism:</b> ${p.first_name} ${p.last_name || ""}\n` +
      `📛 <b>Username:</b> ${usernameStr}\n` +
      `🌐 <b>Til:</b> ${p.language}\n\n` +
      `💎 <b>Plan:</b> ${p.plan}\n` +
      `📅 <b>Premium muddati:</b> ${untilStr}\n` +
      `🗓 <b>Ro'yxatdan o'tgan:</b> ${regStr}\n\n` +
      `📊 <b>Statistika va Faollik:</b>\n` +
      `• 📸 Scan: ${p.scan_used} | 📊 PPT: ${p.ppt_used} | 📄 PDF: ${p.pdf_used}\n` +
      `• 🎫 Support Ticketlar: ${p.support_ticket_count} ta\n` +
      `• 💰 To'lovlar: ${p.payments_count} ta\n` +
      `• 📝 Admin Note lar: ${notes.length} ta\n\n` +
      `STATUS: ${p.is_banned ? `🚫 BANNED (${p.ban_reason})` : p.is_muted ? `🔇 MUTED (${p.mute_reason})` : "✅ Clear"}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "⭐ Premium berish (30 kun)", callback_data: `admin:usr:give_prem:${p.telegram_id}` },
          { text: "❌ Premium olib tashlash", callback_data: `admin:usr:rem_prem:${p.telegram_id}` }
        ],
        [
          p.is_banned
            ? { text: "✅ Unban qilish", callback_data: `admin:usr:unban:${p.telegram_id}` }
            : { text: "🚫 Ban qilish", callback_data: `admin:usr:ban:${p.telegram_id}` },
          p.is_muted
            ? { text: "🔊 Unmute qilish", callback_data: `admin:usr:unmute:${p.telegram_id}` }
            : { text: "🔇 Mute qilish", callback_data: `admin:usr:mute:${p.telegram_id}` }
        ],
        [
          { text: "📝 Note qo'shish", callback_data: `admin:usr:note:${p.telegram_id}` }
        ],
        [
          { text: "⬅️ User Management Menu", callback_data: "admin:users" }
        ]
      ]
    };

    await ctx.replyWithHTML(msg, { reply_markup: keyboard });
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Profilni yuklashda xatolik.");
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:give_prem:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  try {
    await managePremiumV2({
      telegramId: targetId,
      adminId: ctx.from!.id,
      action: "GIVE",
      plan: "STUDENT",
      days: 30,
    });
    await ctx.replyWithHTML(`✅ <code>${targetId}</code> ga 30 kunlik <b>STUDENT</b> Premium berildi!`);
  } catch (err: any) {
    await ctx.reply(`❌ Xatolik: ${err.message}`);
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:rem_prem:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  try {
    await managePremiumV2({
      telegramId: targetId,
      adminId: ctx.from!.id,
      action: "REMOVE",
      plan: "FREE",
    });
    await ctx.replyWithHTML(`✅ <code>${targetId}</code> ning Premium statusi bekor qilindi (FREE).`);
  } catch (err: any) {
    await ctx.reply(`❌ Xatolik: ${err.message}`);
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:ban:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  await setBotState(ctx.from!.id, `owner:waiting_for_ban_reason_${targetId}`);
  await ctx.replyWithHTML(`🚫 <code>${targetId}</code> ni ban qilish uchun sababni kiriting:`);
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:unban:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  await unbanUserV2(targetId);
  await ctx.replyWithHTML(`✅ <code>${targetId}</code> bandan chiqarildi.`);
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:mute:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  await setBotState(ctx.from!.id, `owner:waiting_for_mute_reason_${targetId}`);
  await ctx.replyWithHTML(`🔇 <code>${targetId}</code> ni mute qilish uchun sababni kiriting:`);
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:unmute:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  await unmuteUserV2(targetId);
  await ctx.replyWithHTML(`🔊 <code>${targetId}</code> unmuted qilindi.`);
  await ctx.answerCbQuery();
});

bot.action(/admin:usr:note:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const targetId = Number(ctx.match[1]);
  await setBotState(ctx.from!.id, `owner:waiting_for_user_note_${targetId}`);
  await ctx.replyWithHTML(`📝 <code>${targetId}</code> uchun ichki admin note kiriting:`);
  await ctx.answerCbQuery();
});

bot.action("admin:usr:search_input", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_user_search");
  await ctx.reply("🔍 Foydalanuvchi qidirish uchun parametr kiriting:\n(Telegram ID, Username, Ism, Familiya yoki Plan)");
  await ctx.answerCbQuery();
});

bot.action("admin:usr:export_csv", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  try {
    await ctx.reply("⏳ Users CSV fayli tayyorlanmoqda...");
    const csvData = await exportUsersCSV();
    const buffer = Buffer.from(csvData, "utf-8");
    await ctx.replyWithDocument(
      { source: buffer, filename: `users_export_${Date.now()}.csv` },
      { caption: "📊 <b>Talaba AI — Foydalanuvchilar Ro'yxati (CSV)</b>", parse_mode: "HTML" }
    );
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Export CSV yuklashda xatolik.");
  }
  await ctx.answerCbQuery();
});

bot.action("admin:admins", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await renderAdminsMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:premium", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderPremiumMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:ban", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderBanMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:stats", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderStatsMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:payments", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await renderPaymentsMenu(ctx);
  await ctx.answerCbQuery();
});

bot.action("admin:pay:search_input", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_pay_search");
  await ctx.reply("🔍 Payment qidirish uchun parametr kiriting:\n(Telegram ID, Username, Full Name, Payment ID, Plan yoki Status)");
  await ctx.answerCbQuery();
});

bot.action("admin:pay:analytics_view", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  try {
    const analytics = await getPaymentAnalytics();
    let text = `📊 <b>Payment Analytics Dashboard</b>\n\n`;
    text += `💰 <b>Jami tushum (Total Revenue):</b> ${analytics.total_revenue.toLocaleString("uz-UZ")} UZS\n`;
    text += `📅 <b>Bugungi tushum:</b> ${analytics.today_revenue.toLocaleString("uz-UZ")} UZS\n`;
    text += `🗓 <b>Shu haftalik tushum:</b> ${analytics.week_revenue.toLocaleString("uz-UZ")} UZS\n`;
    text += `📆 <b>Shu oylik tushum:</b> ${analytics.month_revenue.toLocaleString("uz-UZ")} UZS\n\n`;

    text += `📦 <b>Planlar bo'yicha sotuvlar:</b>\n`;
    Object.entries(analytics.plan_counts).forEach(([plan, count]) => {
      text += `  • ${plan}: ${count} ta\n`;
    });

    text += `\n📊 <b>Statuslar bo'yicha bo'linish:</b>\n`;
    Object.entries(analytics.status_counts).forEach(([st, count]) => {
      text += `  • ${st}: ${count} ta\n`;
    });

    const keyboard = {
      inline_keyboard: [[{ text: "⬅️ Payments Inbox ga qaytish", callback_data: "admin:payments" }]]
    };
    await ctx.replyWithHTML(text, { reply_markup: keyboard });
  } catch (err) {
    console.error("Analytics error:", err);
    await ctx.reply("❌ Analytics yuklashda xatolik yuz berdi");
  }
  await ctx.answerCbQuery();
});

bot.action("admin:pay:export_csv", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  try {
    const csvContent = await exportPaymentsCSV();
    const buffer = Buffer.from(csvContent, "utf-8");
    await bot.telegram.sendDocument(ctx.from!.id, Input.fromBuffer(buffer, "payments_export.csv"), {
      caption: "📥 Barcha to'lovlar CSV eksport fayli tayyor."
    });
  } catch (err) {
    console.error("Export CSV error:", err);
    await ctx.reply("❌ CSV eksport qilishda xatolik yuz berdi");
  }
  await ctx.answerCbQuery();
});

bot.action(/admin:pay:confirm:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const paymentId = ctx.match[1];
  
  try {
    const payment = await getPaymentById(paymentId);
    if (!payment) {
      await ctx.answerCbQuery("❌ To'lov topilmadi", { show_alert: true });
      return;
    }

    const updated = await updatePaymentStatus(paymentId, "PAID", ctx.from.id);
    if (!updated) {
      await ctx.answerCbQuery("Bu to'lov allaqachon ko'rib chiqilgan", { show_alert: true });
      return;
    }

    let premiumUntil: Date | null = null;
    if (isValidPaidPlan(payment.plan)) {
      premiumUntil = await givePremium(payment.telegram_id, payment.plan);
    }
    await ctx.answerCbQuery("✅ Payment confirmed & activated!", { show_alert: true });

    // Notify user about successful activation
    try {
      const premiumUntilStr = premiumUntil
        ? premiumUntil.toLocaleDateString("uz-UZ", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: "Asia/Tashkent",
          })
        : "—";
      await bot.telegram.sendMessage(
        payment.telegram_id,
        `🎉 Premium tarifingiz tasdiqlandi!\n\n` +
        `📦 Tarif: ${payment.plan}\n` +
        `📅 Amal qilish muddati: ${premiumUntilStr}\n\n` +
        `Talaba AI Premium muvaffaqiyatli faollashtirildi.`
      );
    } catch (notifyErr) {
      console.error("User confirm notification error:", notifyErr);
    }
    
    // Auto update the message text or refresh Inbox
    const cbMsg = ctx.callbackQuery?.message as any;
    if (cbMsg?.text && !cbMsg.text.includes("Payment Inbox")) {
       await ctx.editMessageText(cbMsg.text + "\n\n✅ <b>Tasdiqlandi (PAID)</b>", { reply_markup: { inline_keyboard: [] }});
    } else {
       await renderPaymentsMenu(ctx);
    }
  } catch (err) {
    console.error(err);
    await ctx.answerCbQuery("❌ Xatolik yuz berdi");
  }
});

bot.action(/admin:pay:reject:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const paymentId = ctx.match[1];
  
  try {
    const payment = await getPaymentById(paymentId);
    if (!payment) {
      await ctx.answerCbQuery("❌ To'lov topilmadi", { show_alert: true });
      return;
    }

    const updated = await updatePaymentStatus(paymentId, "FAILED", ctx.from.id);
    if (!updated) {
      await ctx.answerCbQuery("Bu to'lov allaqachon ko'rib chiqilgan", { show_alert: true });
      return;
    }

    await ctx.answerCbQuery("❌ Payment rejected", { show_alert: true });

    // Notify user about rejection
    try {
      await bot.telegram.sendMessage(
        payment.telegram_id,
        `❌ To'lovingiz tasdiqlanmadi.\n\n` +
        `Iltimos chekni qayta yuboring yoki administrator bilan bog'laning.`
      );
    } catch (notifyErr) {
      console.error("User reject notification error:", notifyErr);
    }
    
    const cbMsg = ctx.callbackQuery?.message as any;
    if (cbMsg?.text && !cbMsg.text.includes("Payment Inbox")) {
       await ctx.editMessageText(cbMsg.text + "\n\n❌ <b>Rad etildi (FAILED)</b>", { reply_markup: { inline_keyboard: [] }});
    } else {
       await renderPaymentsMenu(ctx);
    }
  } catch (err) {
    console.error(err);
    await ctx.answerCbQuery("❌ Xatolik yuz berdi");
  }
});

bot.action(/admin:pay:view:(.+)/, async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  const paymentId = ctx.match[1];

  try {
    const payment = await getPaymentById(paymentId);
    if (!payment || !payment.proof_url) {
      await ctx.answerCbQuery("❌ Chek topilmadi", { show_alert: true });
      return;
    }

    const supabase = getSupabase();
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from("payment-proofs")
      .createSignedUrl(payment.proof_url, 60);

    if (urlError || !urlData) {
      await ctx.answerCbQuery("❌ Rasmni ochishda xatolik", { show_alert: true });
      return;
    }

    const user = await getUser(payment.telegram_id);
    const firstName = user?.firstName || "Unknown";
    const username = user?.username ? `@${user.username}` : "yo'q";
    
    const caption = `👤 Ism: ${firstName}\n` +
      `📛 Username: ${username}\n` +
      `🆔 Telegram ID: <code>${payment.telegram_id}</code>\n` +
      `📦 Tarif: ${payment.plan}\n` +
      `💵 Summa: ${payment.amount} UZS\n` +
      `📅 Sana: ${new Date(payment.created_at).toLocaleString("uz-UZ", {timeZone: "Asia/Tashkent"})}`;

    await ctx.replyWithPhoto(urlData.signedUrl, { caption, parse_mode: "HTML" });
    await ctx.answerCbQuery();
  } catch (err) {
    console.error(err);
    await ctx.answerCbQuery("❌ Xatolik yuz berdi");
  }
});

// INPUT REQUESTS ACTIONS
bot.action("admin:search:start", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_search");
  await ctx.reply("🔍 Iltimos, qidiriladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:broadcast:start", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_broadcast");
  await ctx.reply("📢 Iltimos, barcha foydalanuvchilarga yuboriladigan xabarni kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:admins:add", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_add_admin");
  await ctx.reply("➕ Iltimos, admin qilib qo'shiladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:admins:remove", async (ctx) => {
  if (!isOwner(ctx.from?.id || 0)) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_remove_admin");
  await ctx.reply("➖ Iltimos, admindan o'chiriladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:premium:give", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_give_premium");
  await ctx.reply("💎 Iltimos, premium beriladigan foydalanuvchi ID si va planini kiriting (Masalan: 12345678 MONTH):");
  await ctx.answerCbQuery();
});

bot.action("admin:premium:remove", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_remove_premium");
  await ctx.reply("💎 Iltimos, premium tarif o'chiriladigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:ban:ban", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_ban");
  await ctx.reply("🚫 Iltimos, bloklanadigan foydalanuvchining Telegram ID sini kiriting:");
  await ctx.answerCbQuery();
});

bot.action("admin:ban:unban", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;
  await setBotState(ctx.from!.id, "owner:waiting_for_unban");
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
  if (!(await isAdmin(ctx.from?.id || 0))) return;

  try {
    const premiumUsers = await getPremiumUsers();

    if (premiumUsers.length === 0) {
      await ctx.reply("💎 Hozircha premium foydalanuvchilar yo'q.");
    } else {
      let message = `💎 <b>Premium Users</b>\n\n`;

      premiumUsers.forEach((u, i) => {
        const usernameDisplay = u.username ? `@${u.username}` : "yo'q";
        const untilStr = u.premiumUntil
          ? new Date(u.premiumUntil).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })
          : "—";
        const givenAtStr = u.premiumGivenAt
          ? `\n📅 Premium berilgan vaqt: ${new Date(u.premiumGivenAt).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}`
          : "";

        message += `${i + 1}.\n` +
          `👤 Ism: ${u.firstName}\n` +
          `📛 Username: ${usernameDisplay}\n` +
          `🆔 Telegram ID: <code>${u.telegramId}</code>\n` +
          `📦 Plan: ${u.plan}\n` +
          `📅 Premium Until: ${untilStr}${givenAtStr}\n\n`;
      });
      message += `━━━━━━━━━━\n\n📊 Total Premium Users: ${premiumUsers.length}`;
      await ctx.replyWithHTML(message);
    }
  } catch (error) {
    console.error("premium:list error:", error);
    await ctx.reply("❌ Premium ro'yxatini yuklashda xatolik.");
  }

  await ctx.answerCbQuery();
});

bot.action("admin:ban:list", async (ctx) => {
  if (!(await isAdmin(ctx.from?.id || 0))) return;

  try {
    const list = await getBannedUsers();

    if (list.length === 0) {
      await ctx.reply("🚫 Hozircha bloklangan foydalanuvchilar yo'q.");
    } else {
      let message = `🚫 <b>Banned Users</b>\n\n`;
      list.forEach((u, i) => {
        const usernameDisplay = u.username ? `@${u.username}` : "yo'q";
        const banDate = `${String(u.createdAt.getDate()).padStart(2, '0')}/${String(u.createdAt.getMonth() + 1).padStart(2, '0')}/${u.createdAt.getFullYear()}`;
        message += `${i + 1}.\n\n👤 ${u.firstName}\n📛 ${usernameDisplay}\n🆔 <code>${u.telegramId}</code>\n📅 ${banDate}\n\n`;
      });
      message += `━━━━━━━━━━\n\n📊 Total Banned Users: ${list.length}`;
      await ctx.replyWithHTML(message);
    }
  } catch (error) {
    console.error("ban:list error:", error);
    await ctx.reply("❌ Bloklangan foydalanuvchilar ro'yxatini yuklashda xatolik.");
  }

  await ctx.answerCbQuery();
});

bot.on("message", async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const state = await getBotState(userId);
  if (!state) return next();

  const msgObj = ctx.message as any;
  const text = msgObj.text || msgObj.caption || "";
  if (text.startsWith("/")) {
    await deleteBotState(userId);
    return next();
  }

  // Extract attachment photo or document if provided
  let fileId: string | undefined = undefined;
  let fileType: string | undefined = undefined;

  if (msgObj.photo && msgObj.photo.length > 0) {
    fileId = msgObj.photo[msgObj.photo.length - 1].file_id;
    fileType = "photo";
  } else if (msgObj.document) {
    fileId = msgObj.document.file_id;
    fileType = "document";
  }

  // User Support Ticket Creation state
  if (state.startsWith("user:waiting_for_supp_msg_")) {
    await deleteBotState(userId);
    const category = state.replace("user:waiting_for_supp_msg_", "") as TicketCategory;
    const msgText = text.trim() || (fileId ? "[Fayl biriktirildi]" : "Murojaat");

    try {
      const result = await createTicket({
        telegram_id: userId,
        category: category,
        message_text: msgText,
        telegram_file_id: fileId,
        telegram_file_type: fileType,
      });

      await ctx.replyWithHTML(
        `✅ <b>Murojaatingiz qabul qilindi (#${result.ticket.ticket_number})</b>\n\n` +
        `Tez orada mutaxassislarimiz javob berishadi. Rahmat!`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📋 Mening Murojaatlarim", callback_data: "user:supp:my_tickets" }]
            ]
          }
        }
      );

      // Notify Owner / Admin
      try {
        const user = await getUser(userId);
        const firstName = user?.firstName || ctx.from?.first_name || "Unknown";
        const username = user?.username || ctx.from?.username ? `@${user?.username || ctx.from?.username}` : "yo'q";

        const alertMsg = `🆘 <b>Yangi Murojaat (#${result.ticket.ticket_number})</b>\n\n` +
          `👤 Ism: ${firstName}\n` +
          `📛 Username: ${username}\n` +
          `🆔 Telegram ID: <code>${userId}</code>\n\n` +
          `📁 Kategoriya: <b>${result.ticket.category}</b>\n` +
          `💬 <b>Xabar:</b>\n${msgText}`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "💬 Javob berish", callback_data: `admin:supp:reply:${result.ticket.id}` }],
            [
              { text: "⏳ In Progress", callback_data: `ad:sp:st:${result.ticket.id}:IP` },
              { text: "🔒 Close", callback_data: `ad:sp:st:${result.ticket.id}:CL` }
            ]
          ]
        };

        if (fileId) {
          if (fileType === "photo") {
            await bot.telegram.sendPhoto(6630030492, fileId, { caption: alertMsg, parse_mode: "HTML", reply_markup: keyboard });
          } else {
            await bot.telegram.sendDocument(6630030492, fileId, { caption: alertMsg, parse_mode: "HTML", reply_markup: keyboard });
          }
        } else {
          await bot.telegram.sendMessage(6630030492, alertMsg, { parse_mode: "HTML", reply_markup: keyboard });
        }
      } catch (adminAlertErr) {
        console.error("Admin support alert error:", adminAlertErr);
      }
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Murojaat yaratishda xatolik yuz berdi.");
    }
    return;
  }

  // User Support Ticket Reply state
  if (state.startsWith("user:waiting_for_supp_reply_")) {
    await deleteBotState(userId);
    const ticketId = state.replace("user:waiting_for_supp_reply_", "");
    const msgText = text.trim() || (fileId ? "[Fayl biriktirildi]" : "Javob");

    try {
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        await ctx.reply("❌ Ticket topilmadi.");
        return;
      }

      await addMessageToTicket({
        ticket_id: ticketId,
        sender_id: userId,
        sender_type: "USER",
        message_text: msgText,
        telegram_file_id: fileId,
        telegram_file_type: fileType,
      });

      await ctx.replyWithHTML(`✅ <b>Ticket #${ticket.ticket_number}</b> ga javobingiz yetkazildi.`);

      // Notify Owner / Admin
      try {
        const alertMsg = `💬 <b>Foydalanuvchi javob yozdi (#${ticket.ticket_number})</b>\n\n` +
          `👤 ID: <code>${userId}</code>\n` +
          `💬 <b>Javob:</b>\n${msgText}`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "💬 Javob berish", callback_data: `admin:supp:reply:${ticket.id}` }]
          ]
        };

        if (fileId) {
          if (fileType === "photo") {
            await bot.telegram.sendPhoto(6630030492, fileId, { caption: alertMsg, parse_mode: "HTML", reply_markup: keyboard });
          } else {
            await bot.telegram.sendDocument(6630030492, fileId, { caption: alertMsg, parse_mode: "HTML", reply_markup: keyboard });
          }
        } else {
          await bot.telegram.sendMessage(6630030492, alertMsg, { parse_mode: "HTML", reply_markup: keyboard });
        }
      } catch (adminNotifyErr) {
        console.error("Admin notify error:", adminNotifyErr);
      }
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Javob yuborishda xatolik.");
    }
    return;
  }

  // Admin Support Ticket Reply state
  if (state.startsWith("owner:waiting_for_supp_reply_")) {
    await deleteBotState(userId);
    if (!(await isAdmin(userId))) return next();

    const ticketId = state.replace("owner:waiting_for_supp_reply_", "");
    const msgText = text.trim() || (fileId ? "[Fayl biriktirildi]" : "Admin javobi");

    try {
      const ticket = await getTicketById(ticketId);
      if (!ticket) {
        await ctx.reply("❌ Ticket topilmadi.");
        return;
      }

      await addMessageToTicket({
        ticket_id: ticketId,
        sender_id: userId,
        sender_type: "ADMIN",
        message_text: msgText,
        telegram_file_id: fileId,
        telegram_file_type: fileType,
      });

      await ctx.replyWithHTML(`✅ <b>Ticket #${ticket.ticket_number}</b> uchun javobingiz foydalanuvchiga yuborildi.`);

      // Notify User
      try {
        const userMsg = `💬 <b>Admin Javobi (#${ticket.ticket_number})</b>\n\n${msgText}`;
        const keyboard = {
          inline_keyboard: [
            [{ text: "✍️ Javob qaytarish", callback_data: `user:supp:reply:${ticket.id}` }]
          ]
        };

        if (fileId) {
          if (fileType === "photo") {
            await bot.telegram.sendPhoto(ticket.telegram_id, fileId, { caption: userMsg, parse_mode: "HTML", reply_markup: keyboard });
          } else {
            await bot.telegram.sendDocument(ticket.telegram_id, fileId, { caption: userMsg, parse_mode: "HTML", reply_markup: keyboard });
          }
        } else {
          await bot.telegram.sendMessage(ticket.telegram_id, userMsg, { parse_mode: "HTML", reply_markup: keyboard });
        }
      } catch (userNotifyErr) {
        console.error("User notify error:", userNotifyErr);
      }
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Admin javobini yuborishda xatolik.");
    }
    return;
  }

  // Admin Support Search state
  if (state === "owner:waiting_for_supp_search") {
    await deleteBotState(userId);
    if (!(await isAdmin(userId))) return next();

    try {
      const results = await searchTickets(text.trim());
      if (results.length === 0) {
        await ctx.replyWithHTML(`❌ Hech qanday ticket topilmadi: "<code>${text.trim()}</code>"`);
      } else {
        let msg = `🔍 <b>Support qidiruv natijalari (${results.length} ta):</b>\n\n`;
        const keyboard = { inline_keyboard: [] as any[] };

        for (let i = 0; i < Math.min(results.length, 10); i++) {
          const t = results[i];
          const user = await getUser(t.telegram_id);
          const firstName = user?.firstName || "Unknown";

          msg += `${i + 1}. 🎫 <b>Ticket #${t.ticket_number}</b>\n`;
          msg += `👤 User: ${firstName} (<code>${t.telegram_id}</code>)\n`;
          msg += `📁 Kategoriya: ${CATEGORY_LABELS[t.category] || t.category}\n`;
          msg += `📊 Status: <b>${STATUS_LABELS[t.status] || t.status}</b>\n\n`;

          keyboard.inline_keyboard.push([
            { text: `💬 Javob #${t.ticket_number}`, callback_data: `admin:supp:reply:${t.id}` },
            { text: `🔒 Close`, callback_data: `ad:sp:st:${t.id}:CL` }
          ]);
        }

        keyboard.inline_keyboard.push([{ text: "⬅️ Support Menu", callback_data: "admin:support" }]);
        await ctx.replyWithHTML(msg, { reply_markup: keyboard });
      }
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Qidiruvda xatolik.");
    }
    return;
  }

  // Admin User Ban Reason state
  if (state.startsWith("owner:waiting_for_ban_reason_")) {
    await deleteBotState(userId);
    if (!(await isAdmin(userId))) return next();
    const targetId = Number(state.replace("owner:waiting_for_ban_reason_", ""));

    try {
      await banUserV2(targetId, text.trim() || "Admin qarori bo'yicha");
      await ctx.replyWithHTML(`🚫 <code>${targetId}</code> bloklandi.\n<b>Sabab:</b> ${text.trim() || "Ko'rsatilmadi"}`);
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Ban qilishda xatolik.");
    }
    return;
  }

  // Admin User Mute Reason state
  if (state.startsWith("owner:waiting_for_mute_reason_")) {
    await deleteBotState(userId);
    if (!(await isAdmin(userId))) return next();
    const targetId = Number(state.replace("owner:waiting_for_mute_reason_", ""));

    try {
      await muteUserV2(targetId, text.trim() || "Admin qarori bo'yicha");
      await ctx.replyWithHTML(`🔇 <code>${targetId}</code> cheklandi (Muted).\n<b>Sabab:</b> ${text.trim() || "Ko'rsatilmadi"}`);
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Mute qilishda xatolik.");
    }
    return;
  }

  // Admin Management V2 States
  if (state === "owner:waiting_for_add_admin_id") {
    await deleteBotState(userId);
    if (!isOwner(userId)) return next();
    const targetId = Number(text.trim());
    if (isNaN(targetId) || targetId <= 0) {
      await ctx.reply("❌ Noto'g'ri Telegram ID kiritildi.");
      return;
    }

    try {
      const user = await getUser(targetId);
      const added = await addAdminV2({
        telegramId: targetId,
        name: user?.firstName || "Admin",
        username: user?.username || undefined,
        role: "ADMIN",
        adminId: userId,
      });
      await ctx.replyWithHTML(`✅ <b>Yangi admin muvaffaqiyatli qo'shildi!</b>\n\n🆔 <b>ID:</b> <code>${added.telegram_id}</code>\n👤 <b>Ism:</b> ${added.name || "Admin"}\n🛡 <b>Role:</b> ADMIN\n🟢 <b>Status:</b> ACTIVE`);
    } catch (err: any) {
      console.error("Add admin text handler error:", err);
      await ctx.reply(`❌ Admin qo'shishda xatolik: ${err.message}`);
    }
    return;
  }

  if (state === "owner:waiting_for_remove_admin_id") {
    await deleteBotState(userId);
    if (!isOwner(userId)) return next();
    const targetId = Number(text.trim());
    if (isNaN(targetId) || targetId <= 0) {
      await ctx.reply("❌ Noto'g'ri Telegram ID kiritildi.");
      return;
    }

    try {
      await removeAdminV2(targetId, userId);
      await ctx.replyWithHTML(`✅ Admin <code>${targetId}</code> ro'yxatdan o'chirildi.`);
    } catch (err: any) {
      console.error("Remove admin text handler error:", err);
      await ctx.reply(`❌ Admin o'chirishda xatolik: ${err.message}`);
    }
    return;
  }

  if (state === "owner:waiting_for_disable_admin_id") {
    await deleteBotState(userId);
    if (!isOwner(userId)) return next();
    const targetId = Number(text.trim());
    if (isNaN(targetId) || targetId <= 0) {
      await ctx.reply("❌ Noto'g'ri Telegram ID kiritildi.");
      return;
    }

    try {
      await updateAdminStatus(targetId, "DISABLED", userId);
      await ctx.replyWithHTML(`🔴 Admin <code>${targetId}</code> nofaol holatga keltirildi (DISABLED).`);
    } catch (err: any) {
      console.error("Disable admin text handler error:", err);
      await ctx.reply(`❌ Adminni nofaol qilishda xatolik: ${err.message}`);
    }
    return;
  }

  if (state === "owner:waiting_for_enable_admin_id") {
    await deleteBotState(userId);
    if (!isOwner(userId)) return next();
    const targetId = Number(text.trim());
    if (isNaN(targetId) || targetId <= 0) {
      await ctx.reply("❌ Noto'g'ri Telegram ID kiritildi.");
      return;
    }

    try {
      await updateAdminStatus(targetId, "ACTIVE", userId);
      await ctx.replyWithHTML(`🟢 Admin <code>${targetId}</code> faollashtirildi (ACTIVE).`);
    } catch (err: any) {
      console.error("Enable admin text handler error:", err);
      await ctx.reply(`❌ Adminni faollashtirishda xatolik: ${err.message}`);
    }
    return;
  }

  // Settings V2 States
  if (state === "owner:waiting_for_edit_card") {
    await deleteBotState(userId);
    if (!isOwner(userId)) return next();
    const newCard = text.trim();
    if (!newCard) {
      await ctx.reply("❌ Karta raqami bo'sh bo'lishi mumkin emas.");
      return;
    }
    try {
      await updateSystemSetting("card_number", newCard, "payment", userId);
      await recordAuditLog({
        adminId: userId,
        action: "SETTINGS_UPDATED",
        target: "card_number",
        description: `Updated payment card number to ${newCard}`,
      });
      await ctx.replyWithHTML(`✅ <b>Karta raqami muvaffaqiyatli yangilandi:</b> <code>${newCard}</code>`);
    } catch (err: any) {
      await ctx.reply(`❌ Karta raqamini saqlashda xatolik: ${err.message}`);
    }
    return;
  }

  if (state === "owner:waiting_for_edit_holder") {
    await deleteBotState(userId);
    if (!isOwner(userId)) return next();
    const newHolder = text.trim();
    if (!newHolder) {
      await ctx.reply("❌ Karta egasi ismi bo'sh bo'lishi mumkin emas.");
      return;
    }
    try {
      await updateSystemSetting("card_holder", newHolder, "payment", userId);
      await recordAuditLog({
        adminId: userId,
        action: "SETTINGS_UPDATED",
        target: "card_holder",
        description: `Updated payment card holder to ${newHolder}`,
      });
      await ctx.replyWithHTML(`✅ <b>Karta egasi ismi muvaffaqiyatli yangilandi:</b> ${newHolder}`);
    } catch (err: any) {
      await ctx.reply(`❌ Karta egasi ismini saqlashda xatolik: ${err.message}`);
    }
    return;
  }

  if (state === "owner:waiting_for_audit_search") {
    await deleteBotState(userId);
    if (!(await hasPermission(userId, "audit_log"))) return next();
    const queryStr = text.trim();
    try {
      const { logs, total } = await getAuditLogs({ search: queryStr, limit: 15 });
      if (logs.length === 0) {
        await ctx.replyWithHTML(`📜 "<code>${queryStr}</code>" bo'yicha hech qanday audit log topilmadi.`);
      } else {
        let msg = `🔍 <b>Audit Log qidiruv natijalari (${logs.length} / ${total} ta):</b>\n\n`;
        logs.forEach((l, idx) => {
          const dateStr = new Date(l.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
          msg += `${idx + 1}. ⚡ <b>${l.action}</b> by ${l.admin_name || `ID:${l.admin_id}`}\n`;
          msg += `🎯 Target: ${l.target || "—"} | 📅 ${dateStr}\n`;
          msg += `📝 ${l.description}\n\n`;
        });
        const keyboard = { inline_keyboard: [[{ text: "⬅️ Audit Log ga qaytish", callback_data: "admin:audit" }]] };
        await ctx.replyWithHTML(msg, { reply_markup: keyboard });
      }
    } catch (err) {
      await ctx.reply("❌ Audit log qidiruvida xatolik.");
    }
    return;
  }

  // Admin User Note state
  if (state.startsWith("owner:waiting_for_user_note_")) {
    await deleteBotState(userId);
    if (!(await isAdmin(userId))) return next();
    const targetId = Number(state.replace("owner:waiting_for_user_note_", ""));

    try {
      await addUserNote(targetId, userId, text.trim());
      await ctx.replyWithHTML(`📝 <code>${targetId}</code> uchun ichki note saqlandi.`);
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Note saqlashda xatolik.");
    }
    return;
  }

  // Admin User Search state
  if (state === "owner:waiting_for_user_search") {
    await deleteBotState(userId);
    if (!(await isAdmin(userId))) return next();

    try {
      const results = await searchUsersV2(text.trim());
      if (results.length === 0) {
        await ctx.replyWithHTML(`❌ Hech qanday foydalanuvchi topilmadi: "<code>${text.trim()}</code>"`);
      } else {
        let msg = `🔍 <b>Foydalanuvchi qidiruv natijalari (${results.length} ta):</b>\n\n`;
        const keyboard = { inline_keyboard: [] as any[] };

        for (let i = 0; i < Math.min(results.length, 10); i++) {
          const u = results[i];
          const usernameStr = u.username ? `@${u.username}` : "—";
          msg += `${i + 1}. <b>${u.first_name}</b> (${usernameStr})\n`;
          msg += `🆔 ID: <code>${u.telegram_id}</code> | Plan: <b>${u.plan}</b>\n\n`;

          keyboard.inline_keyboard.push([
            { text: `👤 Profile #${i + 1}`, callback_data: `admin:usr:profile:${u.telegram_id}` }
          ]);
        }

        keyboard.inline_keyboard.push([{ text: "⬅️ User Management Menu", callback_data: "admin:users" }]);
        await ctx.replyWithHTML(msg, { reply_markup: keyboard });
      }
    } catch (err) {
      console.error(err);
      await ctx.reply("❌ Qidiruvda xatolik.");
    }
    return;
  }

  // Check admin authorization for legacy admin state handlers below
  if (!state.startsWith("owner:")) {
    return next();
  }

  // Clear state
  await deleteBotState(userId);

  try {
    if (state === "owner:waiting_for_pay_search") {
      const results = await searchPayments(text.trim());
      if (results.length === 0) {
        await ctx.replyWithHTML(`❌ Hech qanday to'lov topilmadi: "<code>${text.trim()}</code>"`);
      } else {
        let msg = `🔍 <b>To'lov qidiruvi natijalari (${results.length} ta):</b>\n\n`;
        const keyboard = { inline_keyboard: [] as any[] };

        for (let i = 0; i < Math.min(results.length, 10); i++) {
          const p = results[i];
          const user = await getUser(p.telegram_id);
          const firstName = user?.firstName || "Unknown";
          const date = new Date(p.created_at).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

          msg += `${i + 1}. <b>${p.plan}</b> - ${p.amount.toLocaleString("uz-UZ")} UZS\n`;
          msg += `👤 Ism: ${firstName} (<code>${p.telegram_id}</code>)\n`;
          msg += `🆔 Payment ID: <code>${p.id}</code>\n`;
          msg += `📊 Status: <b>${p.status}</b> | 📅 ${date}\n\n`;

          const row: any[] = [];
          if (p.proof_url) {
            row.push({ text: `📸 Proof #${i + 1}`, callback_data: `admin:pay:view:${p.id}` });
          }
          if (p.status === "PENDING" || p.status === "PROOF_UPLOADED") {
            row.push({ text: `✅ Confirm #${i + 1}`, callback_data: `admin:pay:confirm:${p.id}` });
            row.push({ text: `❌ Reject #${i + 1}`, callback_data: `admin:pay:reject:${p.id}` });
          }
          if (row.length > 0) keyboard.inline_keyboard.push(row);
        }

        keyboard.inline_keyboard.push([{ text: "⬅️ Payments Inbox", callback_data: "admin:payments" }]);
        await ctx.replyWithHTML(msg, { reply_markup: keyboard });
      }
    } else if (state === "owner:waiting_for_search") {
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
            `  📄 PDF: ${info.pdfUsed}\n` +
            `  📝 Referat: ${info.referatUsedToday}\n` +
            `  🌐 Translation: ${info.translationUsedToday}\n\n` +
            `🗓 <b>Ro'yxatdan o'tgan:</b> ${createdAt}`;

          await ctx.replyWithHTML(message);
        }
      }
    } else if (state.startsWith("owner:waiting_for_bc_")) {
      const targetType = state.replace("owner:waiting_for_bc_", "") as BroadcastTarget;
      if (!text || text.trim().length === 0) {
        await ctx.reply("❌ Xabar bo'sh bo'lishi mumkin emas.");
      } else {
        const broadcast = await createBroadcastRecord({
          sender_id: userId,
          target_type: targetType,
          message_text: text.trim(),
        });

        const previewHeader = `👁 <b>BROADCAST PREVIEW</b>\n` +
          `🎯 Target: <b>${targetType}</b>\n` +
          `👥 Recipients: <b>${broadcast.total_recipients} ta</b>\n` +
          `━━━━━━━━━━━━━━━━━━━\n\n`;

        const keyboard = {
          inline_keyboard: [
            [{ text: "🚀 Hozir yuborish", callback_data: `admin:bc:confirm:${broadcast.id}` }],
            [{ text: "⏰ 1 soatdan keyin yuborish", callback_data: `admin:bc:schedule:1h:${broadcast.id}` }],
            [{ text: "❌ Bekor qilish", callback_data: `admin:bc:cancel:${broadcast.id}` }]
          ]
        };

        await ctx.replyWithHTML(previewHeader + text.trim(), { reply_markup: keyboard });
      }
    } else if (state === "owner:waiting_for_add_admin") {
      if (!isOwner(userId)) {
        await ctx.reply("❌ Ruxsat berilmagan (Faqat Owner uchun)");
        return;
      }
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
      if (!isOwner(userId)) {
        await ctx.reply("❌ Ruxsat berilmagan (Faqat Owner uchun)");
        return;
      }
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

            // Audit record for manual premium grant
            try {
              const PLAN_PRICES: Record<string, number> = {
                DAY: 2900,
                WEEK: 11900,
                MONTH: 29900,
                QUARTER: 69900,
                YEAR: 199900,
              };
              const transaction_id = `manual_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
              const supabase = getSupabase();
              await supabase.from("payments").insert({
                telegram_id: targetId,
                amount: PLAN_PRICES[plan] || 0,
                provider: "manual",
                plan: plan,
                status: "paid",
                transaction_id: transaction_id,
                confirmed_at: new Date().toISOString(),
                confirmed_by: ctx.from?.id || 6630030492,
              });
            } catch (auditError) {
              console.error("Manual premium payment audit record error:", auditError);
            }

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
  const body = await req.json();

  const fromId = body?.message?.from?.id || body?.callback_query?.from?.id;
  if (fromId) {
    import("@/lib/admin-management").then(({ updateAdminLastActivity }) => {
      updateAdminLastActivity(fromId, true).catch(() => {});
    });
  }

  try {
    await bot.handleUpdate(body);

    return NextResponse.json({
      ok: true,
    });
  } catch (
    error: any
  ) {
    const msg = String(error?.message || error?.description || error || "").toLowerCase();
    if (
      msg.includes("message is not modified") ||
      msg.includes("query is too old") ||
      msg.includes("response timeout expired")
    ) {
      return NextResponse.json({ ok: true });
    }

    console.error(
      "Telegram webhook error:",
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