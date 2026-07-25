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

function isMissingColumnError(error: any, columnName: string): boolean {
  if (!error) return false;
  if (error.code === "PGRST204") return true;
  const msg = (error.message || "").toLowerCase();
  return msg.includes(columnName.toLowerCase()) || msg.includes("schema cache") || msg.includes("could not find");
}

function mapUsageStats(row: any): UsageStats {
  return {
    telegramId: Number(row.telegram_id),
    pptUsedToday: row.ppt_used_today ?? 0,
    pdfUsedToday: row.pdf_used_today ?? 0,
    scanUsedToday: row.scan_used_today ?? 0,
    referatUsedToday: row.referat_used_today ?? 0,
    translationUsedToday: row.translation_used_today ?? 0,
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

  // Ensure user exists before creating usage stats.
  const user = await getUser(telegramId);
  if (!user) {
    await createUser(telegramId, "Telegram User", undefined, "FREE");
  }

  const insertPayload: any = {
    telegram_id: telegramId,
    ppt_used_today: 0,
    pdf_used_today: 0,
    scan_used_today: 0,
    referat_used_today: 0,
    translation_used_today: 0,
    last_reset_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let { data: insertedData, error: insertError } = await supabase
    .from("usage_stats")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertError && isMissingColumnError(insertError, "translation_used_today")) {
    delete insertPayload.translation_used_today;
    const retryRes = await supabase
      .from("usage_stats")
      .insert(insertPayload)
      .select("*")
      .single();
    insertedData = retryRes.data;
    insertError = retryRes.error;
  }

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
  if (updates.referatUsedToday !== undefined) dbUpdates.referat_used_today = updates.referatUsedToday;
  if (updates.translationUsedToday !== undefined) dbUpdates.translation_used_today = updates.translationUsedToday;
  dbUpdates.updated_at = new Date().toISOString();

  const supabase = getSupabase();
  let { data, error } = await supabase
    .from("usage_stats")
    .update(dbUpdates)
    .eq("telegram_id", telegramId)
    .select("*")
    .single();

  if (error && isMissingColumnError(error, "translation_used_today") && dbUpdates.translation_used_today !== undefined) {
    delete dbUpdates.translation_used_today;
    const remainingKeys = Object.keys(dbUpdates).filter((k) => k !== "updated_at");
    if (remainingKeys.length === 0) {
      return await getUsageStats(telegramId);
    }
    const retryRes = await supabase
      .from("usage_stats")
      .update(dbUpdates)
      .eq("telegram_id", telegramId)
      .select("*")
      .single();
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error("Error in updateUsageStats:", error);
    throw error;
  }

  return mapUsageStats(data);
}

export async function resetUsageStats(telegramId: number): Promise<UsageStats> {
  await getUsageStats(telegramId);

  const supabase = getSupabase();
  const resetPayload: any = {
    ppt_used_today: 0,
    pdf_used_today: 0,
    scan_used_today: 0,
    referat_used_today: 0,
    translation_used_today: 0,
    last_reset_date: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("usage_stats")
    .update(resetPayload)
    .eq("telegram_id", telegramId)
    .select("*")
    .single();

  if (error && isMissingColumnError(error, "translation_used_today")) {
    delete resetPayload.translation_used_today;
    const retryRes = await supabase
      .from("usage_stats")
      .update(resetPayload)
      .eq("telegram_id", telegramId)
      .select("*")
      .single();
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error("Error in resetUsageStats:", error);
    throw error;
  }

  return mapUsageStats(data);
}

export async function saveOrUpdateUser(
  telegramId: number,
  firstName: string,
  username?: string
): Promise<User> {
  const user = await getUser(telegramId);
  if (user) {
    const updated = await updateUser(telegramId, {
      firstName,
      username: username || undefined,
    });
    if (!updated) {
      throw new Error(`Failed to update user: ${telegramId}`);
    }
    return updated;
  } else {
    return await createUser(telegramId, firstName, username, "FREE");
  }
}

export async function getBotState(telegramId: number): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("bot_states")
    .select("state")
    .eq("telegram_id", telegramId)
    .single();

  if (error) {
    if (error.code !== "PGRST116" && error.code !== "PGRST205") {
      console.error("Error in getBotState:", error);
    }
    return null;
  }

  return data ? data.state : null;
}

export async function setBotState(telegramId: number, state: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("bot_states")
    .upsert({ telegram_id: telegramId, state, updated_at: new Date().toISOString() });

  if (error) {
    if (error.code === "PGRST205") {
      console.warn("bot_states table missing in Supabase. Please run migration 20260716_bot_states.sql");
      return;
    }
    console.error("Error in setBotState:", error);
    throw error;
  }
}

export async function deleteBotState(telegramId: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("bot_states")
    .delete()
    .eq("telegram_id", telegramId);

  if (error) {
    if (error.code === "PGRST205") return;
    console.error("Error in deleteBotState:", error);
    throw error;
  }
}

