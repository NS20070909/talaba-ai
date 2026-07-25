import { guardCheck } from "@/lib/limit-checker";
import { getUser, createUser } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import type { PlanType } from "@/lib/user";
import { getDocumentLimits } from "./constants";

function tashkentDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function ensureUsageRow(telegramId: number): Promise<void> {
  const user = await getUser(telegramId);
  if (!user) {
    await createUser(telegramId, "Telegram User", undefined, "FREE");
  }

  const supabase = getSupabase();
  const { data } = await supabase
    .from("hujjat_tozalash_usage")
    .select("telegram_id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (!data) {
    const { error } = await supabase.from("hujjat_tozalash_usage").insert({
      telegram_id: telegramId,
      used_today: 0,
      last_reset_date: new Date().toISOString(),
    });
    if (error && error.code !== "23505") {
      console.error("Error in ensureUsageRow insert:", error);
    }
  }
}

async function getUsedToday(telegramId: number): Promise<number> {
  await ensureUsageRow(telegramId);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("hujjat_tozalash_usage")
    .select("used_today, last_reset_date")
    .eq("telegram_id", telegramId)
    .single();

  if (error || !data) return 0;

  const today = tashkentDayKey(new Date());
  const lastReset = tashkentDayKey(new Date(data.last_reset_date));

  if (today !== lastReset) {
    await supabase
      .from("hujjat_tozalash_usage")
      .update({
        used_today: 0,
        last_reset_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("telegram_id", telegramId);
    return 0;
  }

  return data.used_today ?? 0;
}

export interface HujjatUsageInfo {
  plan: PlanType;
  used: number;
  limit: number;
  isUnlimited: boolean;
  maxPages: number;
  maxFileMb: number;
}

export async function getHujjatUsageInfo(telegramId: number): Promise<HujjatUsageInfo> {
  const user = await getUser(telegramId);
  const plan: PlanType = user?.plan ?? "FREE";
  const limits = getDocumentLimits(plan);
  const used = limits.dailyLimit === Infinity ? 0 : await getUsedToday(telegramId);

  return {
    plan,
    used,
    limit: limits.dailyLimit === Infinity ? 0 : limits.dailyLimit,
    isUnlimited: limits.dailyLimit === Infinity,
    maxPages: limits.maxPages,
    maxFileMb: Math.round(limits.maxFileBytes / (1024 * 1024)),
  };
}

export async function canUseHujjatTozalash(
  telegramId: number
): Promise<{ allowed: boolean; remaining: number; banned?: boolean }> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) {
    return {
      allowed: false,
      remaining: 0,
      banned: guard.result?.banned,
    };
  }

  const info = await getHujjatUsageInfo(telegramId);
  if (info.isUnlimited) {
    return { allowed: true, remaining: Infinity };
  }

  const remaining = Math.max(0, info.limit - info.used);
  return { allowed: remaining > 0, remaining };
}

export async function incrementHujjatTozalash(telegramId: number): Promise<void> {
  const info = await getHujjatUsageInfo(telegramId);
  if (info.isUnlimited) return;

  const used = await getUsedToday(telegramId);
  const supabase = getSupabase();

  await supabase
    .from("hujjat_tozalash_usage")
    .update({
      used_today: used + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("telegram_id", telegramId);
}
