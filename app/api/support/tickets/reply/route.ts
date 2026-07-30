import { NextResponse } from "next/server";
import { addMessageToTicket, getTicketById } from "@/lib/support";
import { bot } from "@/lib/bot";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticket_id, sender_id, message_text, telegram_file_id, telegram_file_type } = body;

    if (!ticket_id || !sender_id || !message_text) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const ticket = await getTicketById(ticket_id);
    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    const numSenderId = Number(sender_id);
    const isUserSender = numSenderId === ticket.telegram_id;
    const isAdminSender = await isAdmin(numSenderId);

    if (!isUserSender && !isAdminSender) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    const senderType = isAdminSender ? "ADMIN" : "USER";

    const message = await addMessageToTicket({
      ticket_id: ticket.id,
      sender_id: numSenderId,
      sender_type: senderType,
      message_text,
      telegram_file_id: telegram_file_id || undefined,
      telegram_file_type: telegram_file_type || undefined,
    });

    // Notify recipient
    try {
      if (senderType === "ADMIN") {
        // Notify user about admin reply
        const replyMsg = `💬 <b>Admin Javobi (#${ticket.ticket_number})</b>\n\n${message_text}`;
        const keyboard = {
          inline_keyboard: [
            [{ text: "✍️ Javob qaytarish", callback_data: `user:supp:reply:${ticket.id}` }]
          ]
        };
        await bot.telegram.sendMessage(ticket.telegram_id, replyMsg, { parse_mode: "HTML", reply_markup: keyboard });
      } else {
        // Notify owner about user reply
        const notifyMsg = `💬 <b>Foydalanuvchi javob yozdi (#${ticket.ticket_number})</b>\n\n${message_text}`;
        const keyboard = {
          inline_keyboard: [
            [{ text: "💬 Javob berish", callback_data: `admin:supp:reply:${ticket.id}` }]
          ]
        };
        await bot.telegram.sendMessage(6630030492, notifyMsg, { parse_mode: "HTML", reply_markup: keyboard });
      }
    } catch (notifyErr) {
      console.error("Ticket reply notification error:", notifyErr);
    }

    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error("Reply ticket API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
