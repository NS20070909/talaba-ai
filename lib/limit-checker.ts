import { getUser, getUsageStats, updateUsageStats, resetUsageStats } from "./storage";
import { PLAN_LIMITS } from "./limits";
import { UsageStats, PlanType } from "./user";
import { isBanned, checkAndExpirePremium } from "./admin";

export async function checkDailyReset(telegramId: number): Promise<void> {
  const stats = await getUsageStats(telegramId);
  const now = new Date();
  const lastReset = new Date(stats.lastResetDate);
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  if (formatter.format(now) !== formatter.format(lastReset)) {
    await resetUsageStats(telegramId);
  }
}

// Helper to get stats, resetting them if it's a new day
export async function getOrResetUsage(telegramId: number): Promise<UsageStats> {
  await checkDailyReset(telegramId);
  return await getUsageStats(telegramId);
}

export interface CheckResult {
  allowed: boolean;
  remaining: number;
  banned?: boolean;
}

// ── Shared guard: runs ban check + premium expiry before every limit check ──

export async function guardCheck(telegramId: number): Promise<{ blocked: boolean; result?: CheckResult }> {
  // 1. Ban check
  const banned = await isBanned(telegramId);
  if (banned) {
    return { blocked: true, result: { allowed: false, remaining: 0, banned: true } };
  }

  // 2. Auto-expire premium if past premium_until date
  await checkAndExpirePremium(telegramId);

  // 3. Check and apply daily reset
  await checkDailyReset(telegramId);

  return { blocked: false };
}

// ─────────────────────────────────────────────────────────────────────────────

export async function canUsePPT(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = await getUser(telegramId);
  const plan: PlanType = user ? user.plan : "FREE";
  
  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }
  
  const stats = await getOrResetUsage(telegramId);
  const limit = limits?.pptPerDay || 0;
  const remaining = Math.max(0, limit - stats.pptUsedToday);
  
  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function canUsePDF(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = await getUser(telegramId);
  const plan: PlanType = user ? user.plan : "FREE";
  
  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }
  
  const stats = await getOrResetUsage(telegramId);
  const limit = limits?.pdfPerDay || 0;
  const remaining = Math.max(0, limit - stats.pdfUsedToday);
  
  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function canUseScan(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = await getUser(telegramId);
  const plan: PlanType = user ? user.plan : "FREE";
  
  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }
  
  const stats = await getOrResetUsage(telegramId);
  const limit = limits?.scanPerDay || 0;
  const remaining = Math.max(0, limit - stats.scanUsedToday);
  
  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function incrementPPT(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    pptUsedToday: stats.pptUsedToday + 1,
  });
}

export async function incrementPDF(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    pdfUsedToday: stats.pdfUsedToday + 1,
  });
}

export async function incrementScan(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    scanUsedToday: stats.scanUsedToday + 1,
  });
}

export async function canUseReferat(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = await getUser(telegramId);
  const plan: PlanType = user ? user.plan : "FREE";
  
  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }
  
  const stats = await getOrResetUsage(telegramId);
  const limit = limits?.referatPerDay || 0;
  const remaining = Math.max(0, limit - stats.referatUsedToday);
  
  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function incrementReferat(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    referatUsedToday: stats.referatUsedToday + 1,
  });
}
