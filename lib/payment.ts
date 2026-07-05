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
  proof_url?: string | null;
  proof_uploaded_at?: string | null;
  confirmed_at?: string | null;
  confirmed_by?: number | null;
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

export async function getUserPayments(telegramId: number): Promise<PaymentRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getUserPayments error:", error);
    return [];
  }
  return data || [];
}

export async function getPaymentById(id: string): Promise<PaymentRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("getPaymentById error:", error);
    return null;
  }
  return data;
}

export async function updatePaymentStatus(id: string, status: PaymentStatus, confirmedBy?: number): Promise<boolean> {
  const supabase = getSupabase();
  const updateData: any = { status };
  
  if (status === "paid" || status === "failed") {
    updateData.confirmed_at = new Date().toISOString();
    if (confirmedBy) {
      updateData.confirmed_by = confirmedBy;
    }
  }

  const { data, error } = await supabase
    .from("payments")
    .update(updateData)
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    console.error("updatePaymentStatus error:", error);
    throw error;
  }
  return !!(data && data.length > 0);
}

export async function setPaymentProofUrl(id: string, proofUrl: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payments")
    .update({
      proof_url: proofUrl,
      proof_uploaded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .is("proof_url", null)
    .select("id");

  if (error) {
    console.error("setPaymentProofUrl error:", error);
    throw error;
  }
  return !!(data && data.length > 0);
}
