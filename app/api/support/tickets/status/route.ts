import { NextResponse } from "next/server";
import { updateTicketStatus, updateTicketPriority, getTicketById, TicketStatus, TicketPriority } from "@/lib/support";
import { bot } from "@/lib/bot";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticket_id, admin_id, status, priority } = body;

    if (!admin_id || !(await isAdmin(Number(admin_id)))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (!ticket_id) {
      return NextResponse.json({ success: false, error: "ticket_id is required" }, { status: 400 });
    }

    let ticket = await getTicketById(ticket_id);
    if (!ticket) {
      return NextResponse.json({ success: false, error: "Ticket not found" }, { status: 404 });
    }

    if (status) {
      ticket = await updateTicketStatus(ticket_id, status as TicketStatus);
      // Notify user about status change / closure
      try {
        if (ticket) {
          const statusMsg = `ℹ️ <b>Murojaatingiz holati o'zgardi (#${ticket.ticket_number})</b>\n\n` +
            `Yangi status: <b>${ticket.status}</b>`;
          await bot.telegram.sendMessage(ticket.telegram_id, statusMsg, { parse_mode: "HTML" });
        }
      } catch (err) {
        console.error("Status update notify error:", err);
      }
    }

    if (priority) {
      ticket = await updateTicketPriority(ticket_id, priority as TicketPriority);
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error: any) {
    console.error("Status update API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
