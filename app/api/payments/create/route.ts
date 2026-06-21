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

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    console.error("Payment create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
