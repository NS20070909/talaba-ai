import { getSupabase } from "./supabase";

export type PaymentStatus = "pending" | "paid" | "failed";
export type PaymentProvider = "manual" | "click" | "payme";

export interface PaymentRow {
  id: string;
  telegram_id: number;
  amount: number;
  provider: PaymentProvider;
  plan: string;
  status: PaymentStatus;
  transaction_id: string | null;
  created_at: string;
}

export async function createPayment(data: {
  telegram_id: number;
  amount: number;
  provider: PaymentProvider;
  plan: string;
  status: PaymentStatus;
  transaction_id?: string;
}): Promise<PaymentRow> {
  const supabase = getSupabase();
  const { data: result, error } = await supabase
    .from("payments")
    .insert({
      telegram_id: data.telegram_id,
      amount: data.amount,
      provider: data.provider,
      plan: data.plan,
      status: data.status,
      transaction_id: data.transaction_id || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createPayment error:", error);
    throw error;
  }
  return result;
}

export async function getPaymentsStats(): Promise<{ pending: number; paid: number; failed: number }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("payments").select("status");
  if (error) {
    console.error("getPaymentsStats error:", error);
    return { pending: 0, paid: 0, failed: 0 };
  }
  
  const stats = { pending: 0, paid: 0, failed: 0 };
  data.forEach((p) => {
    if (p.status === "pending") stats.pending++;
    if (p.status === "paid") stats.paid++;
    if (p.status === "failed") stats.failed++;
  });
  return stats;
}

export async function getRecentPayments(limit: number = 20): Promise<PaymentRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getRecentPayments error:", error);
    return [];
  }
  return data || [];
}
