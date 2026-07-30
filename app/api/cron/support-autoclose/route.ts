import { NextResponse } from "next/server";
import { autoCloseResolvedTickets } from "@/lib/support";
import { bot } from "@/lib/bot";

export async function GET(req: Request) {
  try {
    const closedTickets = await autoCloseResolvedTickets();
    let notifiedCount = 0;

    for (const ticket of closedTickets) {
      try {
        await bot.telegram.sendMessage(
          ticket.telegram_id,
          `🔒 <b>Murojaatingiz yopildi (#${ticket.ticket_number})</b>\n\n7 kun davomida faollik bo'lmagani sababli murojaat avtomatik ravishda yopildi.`,
          { parse_mode: "HTML" }
        );
        notifiedCount++;
      } catch (err) {
        console.error(`Auto-close notification error for ticket ${ticket.id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      closedCount: closedTickets.length,
      notifiedCount,
    });
  } catch (error: any) {
    console.error("Support auto-close cron error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
