import { getSupabase } from "./supabase";

export type PaymentStatus =
  | "PENDING"
  | "PROOF_UPLOADED"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "ARCHIVED";

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

export function normalizeStatus(status: string): PaymentStatus {
  const upper = (status || "").toUpperCase();
  if (upper === "PAID" || upper === "SUCCESS") return "PAID";
  if (upper === "FAILED" || upper === "REJECTED") return "FAILED";
  if (upper === "PROOF_UPLOADED") return "PROOF_UPLOADED";
  if (upper === "EXPIRED") return "EXPIRED";
  if (upper === "ARCHIVED") return "ARCHIVED";
  return "PENDING";
}

export async function createPayment(data: {
  telegram_id: number;
  amount: number;
  provider: PaymentProvider;
  plan: string;
  status?: PaymentStatus;
  transaction_id?: string;
  proof_url?: string;
}): Promise<PaymentRow> {
  const supabase = getSupabase();
  const status = data.status || "PENDING";
  const { data: result, error } = await supabase
    .from("payments")
    .insert({
      telegram_id: data.telegram_id,
      amount: data.amount,
      provider: data.provider,
      plan: data.plan,
      status: status,
      transaction_id: data.transaction_id || null,
      proof_url: data.proof_url || null,
      proof_uploaded_at: data.proof_url ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createPayment error:", error);
    throw error;
  }
  return { ...result, status: normalizeStatus(result.status) };
}

export async function createPaymentWithProof(data: {
  telegram_id: number;
  amount: number;
  provider: PaymentProvider;
  plan: string;
  proof_url: string;
}): Promise<PaymentRow> {
  const transaction_id = `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  return await createPayment({
    telegram_id: data.telegram_id,
    amount: data.amount,
    provider: data.provider,
    plan: data.plan,
    status: "PROOF_UPLOADED",
    transaction_id: transaction_id,
    proof_url: data.proof_url,
  });
}

export async function getInboxPayments(limit: number = 50): Promise<PaymentRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .in("status", ["PENDING", "PROOF_UPLOADED", "pending", "proof_uploaded"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getInboxPayments error:", error);
    return [];
  }
  return (data || []).map((row) => ({ ...row, status: normalizeStatus(row.status) }));
}

export async function getPaymentsStats(): Promise<{
  pending: number;
  proof_uploaded: number;
  paid: number;
  failed: number;
  expired: number;
  total_revenue: number;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("payments").select("status, amount");
  if (error) {
    console.error("getPaymentsStats error:", error);
    return { pending: 0, proof_uploaded: 0, paid: 0, failed: 0, expired: 0, total_revenue: 0 };
  }

  const stats = { pending: 0, proof_uploaded: 0, paid: 0, failed: 0, expired: 0, total_revenue: 0 };
  data.forEach((p) => {
    const st = normalizeStatus(p.status);
    if (st === "PENDING") stats.pending++;
    else if (st === "PROOF_UPLOADED") stats.proof_uploaded++;
    else if (st === "PAID") {
      stats.paid++;
      stats.total_revenue += p.amount || 0;
    } else if (st === "FAILED") stats.failed++;
    else if (st === "EXPIRED") stats.expired++;
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
  return (data || []).map((row) => ({ ...row, status: normalizeStatus(row.status) }));
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
  return (data || []).map((row) => ({ ...row, status: normalizeStatus(row.status) }));
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
  return data ? { ...data, status: normalizeStatus(data.status) } : null;
}

export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  confirmedBy?: number
): Promise<boolean> {
  const supabase = getSupabase();
  const updateData: any = { status };

  if (status === "PAID" || status === "FAILED" || status === "EXPIRED") {
    updateData.confirmed_at = new Date().toISOString();
    if (confirmedBy) {
      updateData.confirmed_by = confirmedBy;
    }
  }

  const { data, error } = await supabase
    .from("payments")
    .update(updateData)
    .eq("id", id)
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
      status: "PROOF_UPLOADED",
    })
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("setPaymentProofUrl error:", error);
    throw error;
  }
  return !!(data && data.length > 0);
}

export async function searchPayments(query: string): Promise<PaymentRow[]> {
  const supabase = getSupabase();
  const cleanQuery = query.trim();

  if (!cleanQuery) return [];

  // Search by UUID if query looks like UUID
  if (cleanQuery.match(/^[0-9a-fA-F-]{36}$/)) {
    const payment = await getPaymentById(cleanQuery);
    return payment ? [payment] : [];
  }

  // Search by numeric Telegram ID
  const numericId = Number(cleanQuery);
  if (!isNaN(numericId) && numericId > 0) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("telegram_id", numericId)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      return data.map((row) => ({ ...row, status: normalizeStatus(row.status) }));
    }
  }

  // Search by plan or status
  const upperQuery = cleanQuery.toUpperCase();
  if (["PENDING", "PROOF_UPLOADED", "PAID", "FAILED", "EXPIRED", "ARCHIVED"].includes(upperQuery)) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .ilike("status", upperQuery)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) return data.map((row) => ({ ...row, status: normalizeStatus(row.status) }));
  }

  if (["DAY", "WEEK", "MONTH", "QUARTER", "YEAR", "STARTER", "STUDENT", "PRO", "PREMIUM"].includes(upperQuery)) {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("plan", upperQuery)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) return data.map((row) => ({ ...row, status: normalizeStatus(row.status) }));
  }

  // Search users by name/username first to get telegram_ids
  const { data: matchedUsers } = await supabase
    .from("users")
    .select("telegram_id")
    .or(`first_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%`);

  if (matchedUsers && matchedUsers.length > 0) {
    const userIds = matchedUsers.map((u) => u.telegram_id);
    const { data: payments } = await supabase
      .from("payments")
      .select("*")
      .in("telegram_id", userIds)
      .order("created_at", { ascending: false });
    if (payments) return payments.map((row) => ({ ...row, status: normalizeStatus(row.status) }));
  }

  return [];
}

export async function getPaymentAnalytics(): Promise<{
  total_revenue: number;
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  plan_counts: Record<string, number>;
  status_counts: Record<string, number>;
}> {
  const supabase = getSupabase();
  const { data: payments, error } = await supabase.from("payments").select("*");

  if (error || !payments) {
    return {
      total_revenue: 0,
      today_revenue: 0,
      week_revenue: 0,
      month_revenue: 0,
      plan_counts: {},
      status_counts: {},
    };
  }

  const now = new Date();
  const todayStr = new Date(now.getTime() + 5 * 3600 * 1000).toISOString().split("T")[0]; // Tashkent time
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  let total_revenue = 0;
  let today_revenue = 0;
  let week_revenue = 0;
  let month_revenue = 0;

  const plan_counts: Record<string, number> = {};
  const status_counts: Record<string, number> = {};

  payments.forEach((p) => {
    const status = normalizeStatus(p.status);
    status_counts[status] = (status_counts[status] || 0) + 1;
    plan_counts[p.plan] = (plan_counts[p.plan] || 0) + 1;

    if (status === "PAID") {
      const pAmount = p.amount || 0;
      total_revenue += pAmount;

      const pDate = new Date(p.created_at);
      const pDateStr = new Date(pDate.getTime() + 5 * 3600 * 1000).toISOString().split("T")[0];

      if (pDateStr === todayStr) {
        today_revenue += pAmount;
      }
      if (pDate >= sevenDaysAgo) {
        week_revenue += pAmount;
      }
      if (pDate >= thirtyDaysAgo) {
        month_revenue += pAmount;
      }
    }
  });

  return {
    total_revenue,
    today_revenue,
    week_revenue,
    month_revenue,
    plan_counts,
    status_counts,
  };
}

export async function exportPaymentsCSV(): Promise<string> {
  const supabase = getSupabase();
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (!payments || payments.length === 0) {
    return "ID,Telegram ID,Plan,Amount,Status,Provider,Proof Uploaded,Confirmed At,Created At\n";
  }

  const rows = payments.map((p) => {
    return [
      p.id,
      p.telegram_id,
      p.plan,
      p.amount,
      normalizeStatus(p.status),
      p.provider,
      p.proof_uploaded_at || "",
      p.confirmed_at || "",
      p.created_at,
    ].join(",");
  });

  return ["ID,Telegram ID,Plan,Amount,Status,Provider,Proof Uploaded,Confirmed At,Created At", ...rows].join("\n");
}

export async function checkAndExpirePayments(): Promise<PaymentRow[]> {
  const supabase = getSupabase();
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 3600 * 1000).toISOString();

  // Find payments created more than 48 hours ago that are still pending or proof_uploaded
  const { data: expiredList } = await supabase
    .from("payments")
    .select("*")
    .in("status", ["PENDING", "PROOF_UPLOADED", "pending", "proof_uploaded"])
    .lt("created_at", fortyEightHoursAgo);

  if (!expiredList || expiredList.length === 0) return [];

  const expiredIds = expiredList.map((p) => p.id);

  // Update status to EXPIRED
  await supabase
    .from("payments")
    .update({ status: "EXPIRED", confirmed_at: new Date().toISOString() })
    .in("id", expiredIds);

  return expiredList.map((p) => ({ ...p, status: "EXPIRED" as PaymentStatus }));
}

