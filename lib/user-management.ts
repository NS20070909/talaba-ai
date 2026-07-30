import { getSupabase } from "./supabase";
import { isOwner } from "./admin";

export interface UserProfile {
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  language: string;
  plan: string;
  premium_until: string | null;
  created_at: string;
  updated_at: string;
  last_seen: string;
  is_banned: boolean;
  ban_reason: string | null;
  is_muted: boolean;
  mute_reason: string | null;
  broadcast_enabled: boolean;
  scan_used: number;
  ppt_used: number;
  pdf_used: number;
  referat_used_today: number;
  translation_used_today: number;
  support_ticket_count: number;
  payments_count: number;
}

export interface UserNoteRecord {
  id: string;
  telegram_id: number;
  admin_id: number;
  note_text: string;
  created_at: string;
}

export interface PremiumHistoryRecord {
  id: string;
  telegram_id: number;
  admin_id: number;
  action: "GIVE" | "EXTEND" | "REDUCE" | "REMOVE";
  plan: string;
  days: number;
  expires_at: string | null;
  created_at: string;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  premium_users: number;
  new_users_today: number;
  banned_users: number;
  muted_users: number;
  plan_counts: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PROFILE & LISTING
// ─────────────────────────────────────────────────────────────────────────────

export async function getFullUserProfile(telegramId: number): Promise<UserProfile | null> {
  const supabase = getSupabase();
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error || !user) return null;

  const [ticketRes, payRes] = await Promise.all([
    supabase.from("support_tickets").select("id", { count: "exact" }).eq("telegram_id", telegramId),
    supabase.from("payments").select("id", { count: "exact" }).eq("telegram_id", telegramId),
  ]);

  return {
    telegram_id: Number(user.telegram_id),
    username: user.username || null,
    first_name: user.first_name || "Foydalanuvchi",
    last_name: user.last_name || null,
    language: user.language || "uz",
    plan: user.plan || "FREE",
    premium_until: user.premium_until || null,
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at,
    last_seen: user.last_seen || user.updated_at || user.created_at,
    is_banned: !!user.is_banned,
    ban_reason: user.ban_reason || null,
    is_muted: !!user.is_muted,
    mute_reason: user.mute_reason || null,
    broadcast_enabled: user.broadcast_enabled !== false,
    scan_used: user.scan_used || 0,
    ppt_used: user.ppt_used || 0,
    pdf_used: user.pdf_used || 0,
    referat_used_today: user.referat_used_today || 0,
    translation_used_today: user.translation_used_today || 0,
    support_ticket_count: ticketRes.count || 0,
    payments_count: payRes.count || 0,
  };
}

export async function getFilteredUsers(
  filter: string,
  limit: number = 30,
  offset: number = 0
): Promise<{ users: UserProfile[]; total: number }> {
  const supabase = getSupabase();
  let query = supabase.from("users").select("*", { count: "exact" });

  const upper = filter.toUpperCase();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  if (["FREE", "STARTER", "STUDENT", "PRO", "PREMIUM"].includes(upper)) {
    if (upper === "PREMIUM") {
      query = query.neq("plan", "FREE");
    } else {
      query = query.eq("plan", upper);
    }
  } else if (upper === "BANNED") {
    query = query.eq("is_banned", true);
  } else if (upper === "MUTED") {
    query = query.eq("is_muted", true);
  } else if (upper === "ACTIVE") {
    query = query.gte("last_seen", sevenDaysAgo);
  } else if (upper === "INACTIVE") {
    query = query.lt("last_seen", sevenDaysAgo);
  } else if (upper === "NEW USERS" || upper === "NEW") {
    query = query.gte("created_at", todayStart);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error || !data) return { users: [], total: 0 };

  const profiles: UserProfile[] = data.map((u) => ({
    telegram_id: Number(u.telegram_id),
    username: u.username || null,
    first_name: u.first_name || "User",
    last_name: u.last_name || null,
    language: u.language || "uz",
    plan: u.plan || "FREE",
    premium_until: u.premium_until || null,
    created_at: u.created_at,
    updated_at: u.updated_at || u.created_at,
    last_seen: u.last_seen || u.updated_at || u.created_at,
    is_banned: !!u.is_banned,
    ban_reason: u.ban_reason || null,
    is_muted: !!u.is_muted,
    mute_reason: u.mute_reason || null,
    broadcast_enabled: u.broadcast_enabled !== false,
    scan_used: u.scan_used || 0,
    ppt_used: u.ppt_used || 0,
    pdf_used: u.pdf_used || 0,
    referat_used_today: u.referat_used_today || 0,
    translation_used_today: u.translation_used_today || 0,
    support_ticket_count: 0,
    payments_count: 0,
  }));

  return { users: profiles, total: count || profiles.length };
}

export async function searchUsersV2(query: string): Promise<UserProfile[]> {
  const supabase = getSupabase();
  const clean = query.trim();
  if (!clean) return [];

  const num = Number(clean);
  let builder = supabase.from("users").select("*");

  if (!isNaN(num) && num > 0) {
    builder = builder.eq("telegram_id", num);
  } else {
    builder = builder.or(
      `first_name.ilike.%${clean}%,last_name.ilike.%${clean}%,username.ilike.%${clean}%,plan.ilike.%${clean}%`
    );
  }

  const { data } = await builder.limit(20);
  if (!data) return [];

  return data.map((u) => ({
    telegram_id: Number(u.telegram_id),
    username: u.username || null,
    first_name: u.first_name || "User",
    last_name: u.last_name || null,
    language: u.language || "uz",
    plan: u.plan || "FREE",
    premium_until: u.premium_until || null,
    created_at: u.created_at,
    updated_at: u.updated_at || u.created_at,
    last_seen: u.last_seen || u.updated_at || u.created_at,
    is_banned: !!u.is_banned,
    ban_reason: u.ban_reason || null,
    is_muted: !!u.is_muted,
    mute_reason: u.mute_reason || null,
    broadcast_enabled: u.broadcast_enabled !== false,
    scan_used: u.scan_used || 0,
    ppt_used: u.ppt_used || 0,
    pdf_used: u.pdf_used || 0,
    referat_used_today: u.referat_used_today || 0,
    translation_used_today: u.translation_used_today || 0,
    support_ticket_count: 0,
    payments_count: 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM, BAN, MUTE & NOTES MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function managePremiumV2(data: {
  telegramId: number;
  adminId: number;
  action: "GIVE" | "EXTEND" | "REDUCE" | "REMOVE";
  plan: string;
  days?: number;
}): Promise<void> {
  const supabase = getSupabase();
  const user = await getFullUserProfile(data.telegramId);
  if (!user) throw new Error("User not found");

  let expiresAt: string | null = null;
  const currentExpiry = user.premium_until ? new Date(user.premium_until).getTime() : Date.now();

  if (data.action === "GIVE" || data.action === "EXTEND") {
    const days = data.days || 30;
    const baseTime = data.action === "EXTEND" && currentExpiry > Date.now() ? currentExpiry : Date.now();
    expiresAt = new Date(baseTime + days * 24 * 3600 * 1000).toISOString();
  } else if (data.action === "REDUCE") {
    const days = data.days || 7;
    expiresAt = new Date(Math.max(Date.now(), currentExpiry - days * 24 * 3600 * 1000)).toISOString();
  } else if (data.action === "REMOVE") {
    // Only Owner can permanently remove Premium
    if (!isOwner(data.adminId)) {
      throw new Error("UNAUTHORIZED_OWNER_ONLY: Only Owner can permanently remove Premium.");
    }
    expiresAt = null;
  }

  const newPlan = data.action === "REMOVE" ? "FREE" : data.plan;

  await supabase
    .from("users")
    .update({ plan: newPlan, premium_until: expiresAt, updated_at: new Date().toISOString() })
    .eq("telegram_id", data.telegramId);

  await supabase.from("premium_history").insert({
    telegram_id: data.telegramId,
    admin_id: data.adminId,
    action: data.action,
    plan: newPlan,
    days: data.days || 0,
    expires_at: expiresAt,
  });
}

export async function banUserV2(telegramId: number, reason: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("users")
    .update({ is_banned: true, ban_reason: reason, updated_at: new Date().toISOString() })
    .eq("telegram_id", telegramId);
}

export async function unbanUserV2(telegramId: number): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("users")
    .update({ is_banned: false, ban_reason: null, updated_at: new Date().toISOString() })
    .eq("telegram_id", telegramId);
}

export async function muteUserV2(telegramId: number, reason: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("users")
    .update({ is_muted: true, mute_reason: reason, updated_at: new Date().toISOString() })
    .eq("telegram_id", telegramId);
}

export async function unmuteUserV2(telegramId: number): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from("users")
    .update({ is_muted: false, mute_reason: null, updated_at: new Date().toISOString() })
    .eq("telegram_id", telegramId);
}

export async function addUserNote(telegramId: number, adminId: number, text: string): Promise<UserNoteRecord> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_notes")
    .insert({ telegram_id: telegramId, admin_id: adminId, note_text: text })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getUserNotes(telegramId: number): Promise<UserNoteRecord[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("user_notes")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: false });
  return data || [];
}

export async function deleteUserNote(noteId: string, adminId: number): Promise<void> {
  if (!isOwner(adminId)) {
    throw new Error("UNAUTHORIZED_OWNER_ONLY: Only Owner can delete user notes.");
  }
  const supabase = getSupabase();
  await supabase.from("user_notes").delete().eq("id", noteId);
}

export async function getPremiumHistory(telegramId: number): Promise<PremiumHistoryRecord[]> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from("premium_history")
    .select("*")
    .eq("telegram_id", telegramId)
    .order("created_at", { ascending: false });
  return (data || []) as PremiumHistoryRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICS & EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserStatsV2(): Promise<UserStats> {
  const supabase = getSupabase();
  const { data: users } = await supabase.from("users").select("*");

  if (!users || users.length === 0) {
    return {
      total_users: 0,
      active_users: 0,
      inactive_users: 0,
      premium_users: 0,
      new_users_today: 0,
      banned_users: 0,
      muted_users: 0,
      plan_counts: {},
    };
  }

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  let active = 0, inactive = 0, premium = 0, newToday = 0, banned = 0, muted = 0;
  const plan_counts: Record<string, number> = {};

  users.forEach((u) => {
    const plan = u.plan || "FREE";
    plan_counts[plan] = (plan_counts[plan] || 0) + 1;

    if (plan !== "FREE") premium++;
    if (u.is_banned) banned++;
    if (u.is_muted) muted++;

    const lastSeenTime = u.last_seen ? new Date(u.last_seen).getTime() : new Date(u.created_at).getTime();
    if (now - lastSeenTime <= 7 * 24 * 3600 * 1000) active++;
    else inactive++;

    if (new Date(u.created_at).getTime() >= todayStart.getTime()) newToday++;
  });

  return {
    total_users: users.length,
    active_users: active,
    inactive_users: inactive,
    premium_users: premium,
    new_users_today: newToday,
    banned_users: banned,
    muted_users: muted,
    plan_counts,
  };
}

export async function exportUsersCSV(): Promise<string> {
  const supabase = getSupabase();
  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: false });

  let csv = "Telegram ID,Username,First Name,Last Name,Plan,Premium Until,Is Banned,Is Muted,Created At\n";
  (users || []).forEach((u) => {
    csv += `"${u.telegram_id}","${u.username || ""}","${u.first_name || ""}","${u.last_name || ""}","${u.plan || "FREE"}","${u.premium_until || ""}","${!!u.is_banned}","${!!u.is_muted}","${u.created_at}"\n`;
  });
  return csv;
}

export async function exportUsersJSON(): Promise<string> {
  const supabase = getSupabase();
  const { data: users } = await supabase.from("users").select("*").order("created_at", { ascending: false });
  return JSON.stringify(users || [], null, 2);
}
