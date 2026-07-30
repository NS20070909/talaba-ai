import { NextResponse } from "next/server";
import { createPayment } from "@/lib/payment";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegram_id, amount, plan } = body;

    if (!telegram_id || !amount || !plan) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from("payments")
      .select("*")
      .eq("telegram_id", Number(telegram_id))
      .eq("plan", plan)
      .in("status", ["PENDING", "pending"])
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, payment: existing, duplicate: true });
    }

    const transaction_id = `tmp_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payment = await createPayment({
      telegram_id: Number(telegram_id),
      amount: Number(amount),
      provider: "manual",
      plan: plan,
      status: "PENDING",
      transaction_id: transaction_id,
    });

    return NextResponse.json({ success: true, payment });
  } catch (error: any) {
    console.error("Payment create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
