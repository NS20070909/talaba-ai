import { NextResponse } from "next/server";
import { createPayment } from "@/lib/payment";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegram_id, amount, plan } = body;

    if (!telegram_id || !amount || !plan) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const transaction_id = `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payment = await createPayment({
      telegram_id: Number(telegram_id),
      amount: Number(amount),
      provider: "manual",
      plan: plan,
      status: "pending",
      transaction_id: transaction_id,
    });

    try {
      const { getUser } = await import("@/lib/storage");
      const { bot } = await import("@/lib/bot");
      const { OWNER_ID } = await import("@/lib/admin");
      
      const user = await getUser(Number(telegram_id));
      const firstNameDisplay = user?.firstName ? user.firstName : "Noma'lum";
      const usernameDisplay = user?.username ? `@${user.username}` : "Mavjud emas";

      const msg = `🆕 Yangi Premium So'rov\n\n` +
        `👤 Ism: ${firstNameDisplay}\n\n` +
        `📛 Username: ${usernameDisplay}\n\n` +
        `🆔 ID: ${telegram_id}\n\n` +
        `📦 Tarif: ${plan}\n\n` +
        `💵 Summa: ${amount} so'm\n\n` +
        `📅 Vaqt: ${new Date(payment.created_at).toLocaleString("uz-UZ", {timeZone: "Asia/Tashkent"})}\n\n` +
        `Status:\n⏳ Pending`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: "✅ Confirm", callback_data: `admin:pay:confirm:${payment.id}` },
            { text: "❌ Reject", callback_data: `admin:pay:reject:${payment.id}` }
          ]
        ]
      };

      await bot.telegram.sendMessage(OWNER_ID, msg, { reply_markup: inlineKeyboard });
    } catch (e) {
      console.error("Auto notification error:", e);
    }

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    console.error("Payment create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
