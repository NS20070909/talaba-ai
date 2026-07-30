import { getSupabase } from "./supabase";
import { bot } from "./bot";

export type BroadcastTarget = "USERS" | "GROUPS" | "CHANNELS" | "PREMIUM" | "EVERYONE";
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "completed" | "failed";

export interface BroadcastRecord {
  id: string;
  sender_id: number;
  target_type: BroadcastTarget;
  message_text: string;
  status: BroadcastStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_recipients: number;
  delivered_count: number;
  failed_count: number;
  failed_recipients: number[];
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT REGISTRY (Groups & Channels)
// ─────────────────────────────────────────────────────────────────────────────

export async function saveGroupChat(chatId: number, title: string, type: string = "group"): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("bot_groups")
    .upsert({ chat_id: chatId, title, type, created_at: new Date().toISOString() }, { onConflict: "chat_id" });

  if (error && error.code !== "PGRST205") {
    console.error("saveGroupChat error:", error);
  }
}

export async function removeGroupChat(chatId: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("bot_groups").delete().eq("chat_id", chatId);
  if (error && error.code !== "PGRST205") {
    console.error("removeGroupChat error:", error);
  }
}

export async function saveChannelChat(chatId: number, title: string, username?: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("bot_channels")
    .upsert({ chat_id: chatId, title, username: username || null, created_at: new Date().toISOString() }, { onConflict: "chat_id" });

  if (error && error.code !== "PGRST205") {
    console.error("saveChannelChat error:", error);
  }
}

export async function removeChannelChat(chatId: number): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("bot_channels").delete().eq("chat_id", chatId);
  if (error && error.code !== "PGRST205") {
    console.error("removeChannelChat error:", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TARGET RECIPIENTS RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export async function getBroadcastRecipients(targetType: BroadcastTarget): Promise<number[]> {
  const supabase = getSupabase();

  if (targetType === "USERS") {
    const { data } = await supabase.from("users").select("telegram_id");
    return (data || []).map((row: any) => Number(row.telegram_id));
  }

  if (targetType === "PREMIUM") {
    const { data } = await supabase
      .from("users")
      .select("telegram_id")
      .neq("plan", "FREE");
    return (data || []).map((row: any) => Number(row.telegram_id));
  }

  if (targetType === "GROUPS") {
    const { data } = await supabase.from("bot_groups").select("chat_id");
    return (data || []).map((row: any) => Number(row.chat_id));
  }

  if (targetType === "CHANNELS") {
    const { data } = await supabase.from("bot_channels").select("chat_id");
    return (data || []).map((row: any) => Number(row.chat_id));
  }

  if (targetType === "EVERYONE") {
    const [usersRes, groupsRes, channelsRes] = await Promise.all([
      supabase.from("users").select("telegram_id"),
      supabase.from("bot_groups").select("chat_id"),
      supabase.from("bot_channels").select("chat_id"),
    ]);

    const users = (usersRes.data || []).map((r: any) => Number(r.telegram_id));
    const groups = (groupsRes.data || []).map((r: any) => Number(r.chat_id));
    const channels = (channelsRes.data || []).map((r: any) => Number(r.chat_id));

    return Array.from(new Set([...users, ...groups, ...channels]));
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST RECORD CREATION & MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export async function createBroadcastRecord(data: {
  sender_id: number;
  target_type: BroadcastTarget;
  message_text: string;
  scheduled_at?: string | null;
  status?: BroadcastStatus;
}): Promise<BroadcastRecord> {
  const supabase = getSupabase();
  const recipients = await getBroadcastRecipients(data.target_type);
  const status = data.scheduled_at ? "scheduled" : data.status || "draft";

  const { data: result, error } = await supabase
    .from("broadcasts")
    .insert({
      sender_id: data.sender_id,
      target_type: data.target_type,
      message_text: data.message_text,
      status: status,
      scheduled_at: data.scheduled_at || null,
      total_recipients: recipients.length,
      delivered_count: 0,
      failed_count: 0,
      failed_recipients: [],
    })
    .select("*")
    .single();

  if (error) {
    console.error("createBroadcastRecord error:", error);
    throw error;
  }
  return { ...result, failed_recipients: result.failed_recipients || [] };
}

export async function getBroadcastHistory(limit: number = 20): Promise<BroadcastRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("broadcasts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code !== "PGRST205") {
      console.error("getBroadcastHistory error:", error);
    }
    return [];
  }

  return (data || []).map((row: any) => ({
    ...row,
    failed_recipients: row.failed_recipients || [],
  }));
}

export async function getBroadcastById(id: string): Promise<BroadcastRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return { ...data, failed_recipients: data.failed_recipients || [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION & RETRY PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

export async function executeBroadcast(broadcastId: string): Promise<BroadcastRecord> {
  const supabase = getSupabase();
  const broadcast = await getBroadcastById(broadcastId);
  if (!broadcast) throw new Error("Broadcast not found");

  const recipients = await getBroadcastRecipients(broadcast.target_type);
  const startedAt = new Date().toISOString();

  await supabase
    .from("broadcasts")
    .update({ status: "sending", started_at: startedAt, total_recipients: recipients.length })
    .eq("id", broadcastId);

  let deliveredCount = 0;
  let failedCount = 0;
  const failedRecipients: number[] = [];

  for (const targetId of recipients) {
    try {
      await bot.telegram.sendMessage(targetId, broadcast.message_text, { parse_mode: "HTML" });
      deliveredCount++;
    } catch (err: any) {
      failedCount++;
      failedRecipients.push(targetId);

      // Handle Telegram rate limits (429 Too Many Requests)
      if (err?.code === 429 || err?.response?.error_code === 429 || err?.parameters?.retry_after) {
        const retryAfter = (err?.parameters?.retry_after || 1) * 1000;
        await new Promise((res) => setTimeout(res, Math.min(retryAfter, 3000)));
      }
    }
    // Throttle rate ~25 messages/sec
    await new Promise((res) => setTimeout(res, 40));
  }

  const completedAt = new Date().toISOString();
  const finalStatus: BroadcastStatus = failedCount === recipients.length && recipients.length > 0 ? "failed" : "completed";

  const { data: updated } = await supabase
    .from("broadcasts")
    .update({
      status: finalStatus,
      completed_at: completedAt,
      delivered_count: deliveredCount,
      failed_count: failedCount,
      failed_recipients: failedRecipients,
    })
    .eq("id", broadcastId)
    .select("*")
    .single();

  return { ...updated, failed_recipients: updated.failed_recipients || [] };
}

export async function retryFailedBroadcast(broadcastId: string): Promise<BroadcastRecord> {
  const supabase = getSupabase();
  const broadcast = await getBroadcastById(broadcastId);
  if (!broadcast) throw new Error("Broadcast not found");

  const targets = broadcast.failed_recipients || [];
  if (targets.length === 0) return broadcast;

  let retriedDelivered = 0;
  const stillFailed: number[] = [];

  for (const targetId of targets) {
    try {
      await bot.telegram.sendMessage(targetId, broadcast.message_text, { parse_mode: "HTML" });
      retriedDelivered++;
    } catch (err: any) {
      stillFailed.push(targetId);
      if (err?.code === 429 || err?.response?.error_code === 429 || err?.parameters?.retry_after) {
        const retryAfter = (err?.parameters?.retry_after || 1) * 1000;
        await new Promise((res) => setTimeout(res, Math.min(retryAfter, 3000)));
      }
    }
    await new Promise((res) => setTimeout(res, 40));
  }

  const newDelivered = broadcast.delivered_count + retriedDelivered;
  const newFailed = stillFailed.length;
  const finalStatus: BroadcastStatus = newFailed === 0 ? "completed" : broadcast.status;

  const { data: updated } = await supabase
    .from("broadcasts")
    .update({
      delivered_count: newDelivered,
      failed_count: newFailed,
      failed_recipients: stillFailed,
      status: finalStatus,
    })
    .eq("id", broadcastId)
    .select("*")
    .single();

  return { ...updated, failed_recipients: updated.failed_recipients || [] };
}

export async function processScheduledBroadcasts(): Promise<number> {
  const supabase = getSupabase();
  const nowIso = new Date().toISOString();

  const { data: dueBroadcasts } = await supabase
    .from("broadcasts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso);

  if (!dueBroadcasts || dueBroadcasts.length === 0) return 0;

  let count = 0;
  for (const item of dueBroadcasts) {
    try {
      await executeBroadcast(item.id);
      count++;
    } catch (err) {
      console.error(`Scheduled broadcast execution error for ${item.id}:`, err);
    }
  }

  return count;
}
