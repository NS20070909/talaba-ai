import { User, UsageStats, PlanType } from "./user";
import { getSupabase } from "./supabase";
import { bot } from "./bot";

function mapUser(row: any): User {
  return {
    telegramId: Number(row.telegram_id),
    firstName: row.first_name,
    username: row.username || undefined,
    plan: row.plan as PlanType,
    premiumUntil: row.premium_until ? new Date(row.premium_until) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapUsageStats(row: any): UsageStats {
  return {
    telegramId: Number(row.telegram_id),
    pptUsedToday: row.ppt_used_today,
    pdfUsedToday: row.pdf_used_today,
    scanUsedToday: row.scan_used_today,
    lastResetDate: new Date(row.last_reset_date),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function getUser(telegramId: number): Promise<User | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error in getUser:", error);
    throw error;
  }

  return data ? mapUser(data) : null;
}

export async function createUser(
  telegramId: number,
  firstName: string,
  username?: string,
  plan: PlanType = "FREE"
): Promise<User> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .insert({
      telegram_id: telegramId,
      first_name: firstName,
      username: username || null,
      plan: plan,
      premium_until: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error in createUser:", error);
    throw error;
  }

  const user = mapUser(data);

  // Notify Owner
  try {
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const usernameDisplay = username ? `@${username}` : "yo'q";
    const currentTime = new Date().toLocaleString("uz-UZ", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const ownerMsg = `🆕 Yangi foydalanuvchi\n\n` +
      `👤 Ism: ${firstName}\n` +
      `📛 Username: ${usernameDisplay}\n` +
      `🆔 ID: ${telegramId}\n\n` +
      `📅 Vaqt: ${currentTime}\n\n` +
      `👥 Jami userlar: ${totalUsers || 0}`;

    await bot.telegram.sendMessage(6630030492, ownerMsg);
  } catch (err) {
    // catch errors silently
    console.error("Owner notification failed:", err);
  }

  return user;
}

export async function updateUser(
  telegramId: number,
  updates: Partial<Omit<User, "telegramId" | "createdAt" | "updatedAt">>
): Promise<User | null> {
  const dbUpdates: any = {};
  if (updates.firstName !== undefined) dbUpdates.first_name = updates.firstName;
  if (updates.username !== undefined) dbUpdates.username = updates.username || null;
  if (updates.plan !== undefined) dbUpdates.plan = updates.plan;
  if (updates.premiumUntil !== undefined) {
    dbUpdates.premium_until = updates.premiumUntil ? updates.premiumUntil.toISOString() : null;
  }
  dbUpdates.updated_at = new Date().toISOString();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update(dbUpdates)
    .eq("telegram_id", telegramId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error in updateUser:", error);
    throw error;
  }

  return data ? mapUser(data) : null;
}

export async function getUsageStats(telegramId: number): Promise<UsageStats> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("usage_stats")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error in getUsageStats select:", error);
    throw error;
  }

  if (data) {
    return mapUsageStats(data);
  }

  // Ensure user exists before creating usage stats (auto-create if missing)
  const user = await getUser(telegramId);
  if (!user) {
    await createUser(telegramId, "Telegram User", undefined, "FREE");
  }

  const { data: insertedData, error: insertError } = await supabase
    .from("usage_stats")
    .insert({
      telegram_id: telegramId,
      ppt_used_today: 0,
      pdf_used_today: 0,
      scan_used_today: 0,
      last_reset_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: refetchedData } = await supabase
        .from("usage_stats")
        .select("*")
        .eq("telegram_id", telegramId)
        .single();
      if (refetchedData) {
        return mapUsageStats(refetchedData);
      }
    }
    console.error("Error in getUsageStats insert:", insertError);
    throw insertError;
  }

  return mapUsageStats(insertedData);
}

export async function updateUsageStats(
  telegramId: number,
  updates: Partial<Omit<UsageStats, "telegramId" | "lastResetDate" | "createdAt" | "updatedAt">>
): Promise<UsageStats> {
  await getUsageStats(telegramId);

  const dbUpdates: any = {};
  if (updates.pptUsedToday !== undefined) dbUpdates.ppt_used_today = updates.pptUsedToday;
  if (updates.pdfUsedToday !== undefined) dbUpdates.pdf_used_today = updates.pdfUsedToday;
  if (updates.scanUsedToday !== undefined) dbUpdates.scan_used_today = updates.scanUsedToday;
  dbUpdates.updated_at = new Date().toISOString();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("usage_stats")
    .update(dbUpdates)
    .eq("telegram_id", telegramId)
    .select("*")
    .single();

  if (error) {
    console.error("Error in updateUsageStats:", error);
    throw error;
  }

  return mapUsageStats(data);
}

export async function resetUsageStats(telegramId: number): Promise<UsageStats> {
  await getUsageStats(telegramId);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("usage_stats")
    .update({
      ppt_used_today: 0,
      pdf_used_today: 0,
      scan_used_today: 0,
      last_reset_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("telegram_id", telegramId)
    .select("*")
    .single();

  if (error) {
    console.error("Error in resetUsageStats:", error);
    throw error;
  }

  return mapUsageStats(data);
}
