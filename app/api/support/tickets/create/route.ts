import { NextResponse } from "next/server";
import { createTicket, TicketCategory, TicketPriority } from "@/lib/support";
import { bot } from "@/lib/bot";
import { getUser } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegram_id, category, message_text, priority, telegram_file_id, telegram_file_type } = body;

    if (!telegram_id || !category || !message_text) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const result = await createTicket({
      telegram_id: Number(telegram_id),
      category: category as TicketCategory,
      message_text: message_text,
      priority: priority as TicketPriority,
      telegram_file_id: telegram_file_id || undefined,
      telegram_file_type: telegram_file_type || undefined,
    });

    // Notify Owner / Admin on New Ticket Creation
    try {
      const user = await getUser(Number(telegram_id));
      const firstName = user?.firstName || "Unknown";
      const username = user?.username ? `@${user.username}` : "yo'q";

      const ownerMsg = `🆘 <b>Yangi Murojaat (#${result.ticket.ticket_number})</b>\n\n` +
        `👤 Ism: ${firstName}\n` +
        `📛 Username: ${username}\n` +
        `🆔 Telegram ID: <code>${result.ticket.telegram_id}</code>\n\n` +
        `📁 Kategoriya: <b>${result.ticket.category}</b>\n` +
        `🚩 Prioritet: <b>${result.ticket.priority}</b>\n\n` +
        `💬 <b>Xabar:</b>\n${result.message.message_text}`;

      const keyboard = {
        inline_keyboard: [
          [{ text: "💬 Javob berish", callback_data: `admin:supp:reply:${result.ticket.id}` }],
          [
            { text: "⏳ In Progress", callback_data: `admin:supp:status:${result.ticket.id}:IN_PROGRESS` },
            { text: "🔒 Yopish", callback_data: `admin:supp:status:${result.ticket.id}:CLOSED` }
          ]
        ]
      };

      await bot.telegram.sendMessage(6630030492, ownerMsg, { parse_mode: "HTML", reply_markup: keyboard });
    } catch (notifyErr) {
      console.error("Owner support notification error:", notifyErr);
    }

    return NextResponse.json({ success: true, ticket: result.ticket, message: result.message });
  } catch (error: any) {
    console.error("Create ticket API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
