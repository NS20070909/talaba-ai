import { NextResponse } from "next/server";
import { checkAndExpirePayments } from "@/lib/payment";
import { bot } from "@/lib/bot";

export async function GET(req: Request) {
  try {
    const expiredList = await checkAndExpirePayments();
    let notifiedCount = 0;

    for (const payment of expiredList) {
      try {
        await bot.telegram.sendMessage(
          payment.telegram_id,
          `⚠️ <b>To'lov so'rovingiz muddati tugadi.</b>\n\nIltimos yangi so'rov yarating.`,
          { parse_mode: "HTML" }
        );
        notifiedCount++;
      } catch (notifyErr) {
        console.error(`Failed to send 48h expiration alert to user ${payment.telegram_id}:`, notifyErr);
      }
    }

    return NextResponse.json({
      success: true,
      expiredCount: expiredList.length,
      notifiedCount,
    });
  } catch (error: any) {
    console.error("Error in GET /api/cron/payment-expiration:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
