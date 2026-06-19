import { getSupabase } from "./supabase";
import { getUser, updateUser, getUsageStats } from "./storage";
import { PlanType } from "./user";
import { PLAN_DURATION_DAYS } from "./limits";

// ─────────────────────────────────────────────────────────────────────────────
// OWNER
// ─────────────────────────────────────────────────────────────────────────────

export const OWNER_ID = 6630030492;

export function isOwner(telegramId: number): boolean {
  return telegramId === OWNER_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN CHECK
// ─────────────────────────────────────────────────────────────────────────────

export async function isAdmin(telegramId: number): Promise<boolean> {
  if (isOwner(telegramId)) return true;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("admins")
    .select("id")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("isAdmin error:", error);
  }
  return !!data;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN MANAGEMENT (Owner only)
// ─────────────────────────────────────────────────────────────────────────────

export async function addAdmin(telegramId: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("admins")
    .upsert({ telegram_id: telegramId, created_at: new Date().toISOString() }, { onConflict: "telegram_id" });

  if (error) {
    console.error("addAdmin error:", error);
    throw error;
  }
}

export async function removeAdmin(telegramId: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("admins")
    .delete()
    .eq("telegram_id", telegramId);

  if (error) {
    console.error("removeAdmin error:", error);
    throw error;
  }
}

export async function getAdminCount(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("admins")
    .select("*", { count: "exact", head: true });

  if (error) {
    console.error("getAdminCount error:", error);
    return 0;
  }
  // +1 for the owner who is always admin
  return (count ?? 0) + 1;
}

export async function getAdmins(): Promise<number[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("admins")
    .select("telegram_id")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getAdmins error:", error);
    return [];
  }
  return (data ?? []).map((row: { telegram_id: number }) => Number(row.telegram_id));
}

// ─────────────────────────────────────────────────────────────────────────────
// BAN SYSTEM (Owner only)
// ─────────────────────────────────────────────────────────────────────────────

export async function banUser(telegramId: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("banned_users")
    .upsert({ telegram_id: telegramId, created_at: new Date().toISOString() }, { onConflict: "telegram_id" });

  if (error) {
    console.error("banUser error:", error);
    throw error;
  }
}

export async function unbanUser(telegramId: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("banned_users")
    .delete()
    .eq("telegram_id", telegramId);

  if (error) {
    console.error("unbanUser error:", error);
    throw error;
  }
}

export async function isBanned(telegramId: number): Promise<boolean> {
  if (isOwner(telegramId)) return false;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("banned_users")
    .select("id")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("isBanned error:", error);
  }
  return !!data;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM EXPIRY (auto-called on every interaction)
// ─────────────────────────────────────────────────────────────────────────────

export async function checkAndExpirePremium(telegramId: number): Promise<void> {
  const user = await getUser(telegramId);
  if (!user) return;

  // Only non-FREE plans with a premiumUntil date can expire
  if (user.plan === "FREE" || !user.premiumUntil) return;

  const now = new Date();
  if (now > user.premiumUntil) {
    await updateUser(telegramId, { plan: "FREE", premiumUntil: null });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM MANAGEMENT (Owner only)
// ─────────────────────────────────────────────────────────────────────────────

const PAID_PLANS: PlanType[] = ["DAY", "WEEK", "MONTH", "QUARTER", "YEAR"];

export function isValidPaidPlan(plan: string): plan is PlanType {
  return PAID_PLANS.includes(plan as PlanType);
}

export async function givePremium(telegramId: number, plan: PlanType): Promise<Date> {
  const durationDays = PLAN_DURATION_DAYS[plan];
  if (!durationDays) throw new Error(`Unknown plan: ${plan}`);

  const premiumUntil = new Date();
  premiumUntil.setDate(premiumUntil.getDate() + durationDays);

  await updateUser(telegramId, { plan, premiumUntil });
  return premiumUntil;
}

export async function removePremium(telegramId: number): Promise<void> {
  await updateUser(telegramId, { plan: "FREE", premiumUntil: null });
}

// ─────────────────────────────────────────────────────────────────────────────
// USER INFO
// ─────────────────────────────────────────────────────────────────────────────

export interface AdminUserInfo {
  telegramId: number;
  firstName: string;
  username?: string;
  plan: PlanType;
  premiumUntil: Date | null;
  premiumActive: boolean;
  scanUsed: number;
  pdfUsed: number;
  pptUsed: number;
  createdAt: Date;
}

export async function getUserInfo(telegramId: number): Promise<AdminUserInfo | null> {
  const user = await getUser(telegramId);
  if (!user) return null;

  // Auto-expire before returning info
  await checkAndExpirePremium(telegramId);
  const freshUser = await getUser(telegramId);
  if (!freshUser) return null;

  let stats = { scanUsedToday: 0, pdfUsedToday: 0, pptUsedToday: 0 };
  try {
    const s = await getUsageStats(telegramId);
    stats = { scanUsedToday: s.scanUsedToday, pdfUsedToday: s.pdfUsedToday, pptUsedToday: s.pptUsedToday };
  } catch {
    // stats table may not exist for this user yet
  }

  const now = new Date();
  const premiumActive =
    freshUser.plan !== "FREE" &&
    !!freshUser.premiumUntil &&
    freshUser.premiumUntil > now;

  return {
    telegramId: freshUser.telegramId,
    firstName: freshUser.firstName,
    username: freshUser.username,
    plan: freshUser.plan,
    premiumUntil: freshUser.premiumUntil ?? null,
    premiumActive,
    scanUsed: stats.scanUsedToday,
    pdfUsed: stats.pdfUsedToday,
    pptUsed: stats.pptUsedToday,
    createdAt: freshUser.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM STATISTICS
// ─────────────────────────────────────────────────────────────────────────────

export interface SystemStats {
  totalUsers: number;
  premiumUsers: number;
  freeUsers: number;
  scanToday: number;
  pptToday: number;
  pdfToday: number;
  adminCount: number;
}

export async function getSystemStats(): Promise<SystemStats> {
  const supabase = getSupabase();

  // Total users
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  // Premium users (plan != FREE)
  const { count: premiumUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .neq("plan", "FREE");

  // Today's usage totals
  const today = new Date().toDateString();
  const { data: usageRows } = await supabase
    .from("usage_stats")
    .select("scan_used_today, ppt_used_today, pdf_used_today, last_reset_date");

  let scanToday = 0;
  let pptToday = 0;
  let pdfToday = 0;

  if (usageRows) {
    for (const row of usageRows) {
      // Only count rows that were reset today (active today)
      if (new Date(row.last_reset_date).toDateString() === today) {
        scanToday += row.scan_used_today ?? 0;
        pptToday += row.ppt_used_today ?? 0;
        pdfToday += row.pdf_used_today ?? 0;
      }
    }
  }

  const adminCount = await getAdminCount();
  const total = totalUsers ?? 0;
  const premium = premiumUsers ?? 0;

  return {
    totalUsers: total,
    premiumUsers: premium,
    freeUsers: total - premium,
    scanToday,
    pptToday,
    pdfToday,
    adminCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllUserIds(): Promise<number[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("telegram_id");

  if (error) {
    console.error("getAllUserIds error:", error);
    return [];
  }
  return (data ?? []).map((row: { telegram_id: number }) => Number(row.telegram_id));
}
