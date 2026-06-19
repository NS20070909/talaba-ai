import { getUser, getUsageStats, updateUsageStats, resetUsageStats } from "./storage";
import { PLAN_LIMITS } from "./limits";
import { UsageStats, PlanType } from "./user";
import { isBanned, checkAndExpirePremium } from "./admin";

// Helper to get stats, resetting them if it's a new day
export async function getOrResetUsage(telegramId: number): Promise<UsageStats> {
  let stats = await getUsageStats(telegramId);
  const now = new Date();
  const lastReset = new Date(stats.lastResetDate);
  
  if (now.toDateString() !== lastReset.toDateString()) {
    stats = await resetUsageStats(telegramId);
  }
  return stats;
}

export interface CheckResult {
  allowed: boolean;
  remaining: number;
  banned?: boolean;
}

// ── Shared guard: runs ban check + premium expiry before every limit check ──

async function guardCheck(telegramId: number): Promise<{ blocked: boolean; result?: CheckResult }> {
  // 1. Ban check
  const banned = await isBanned(telegramId);
  if (banned) {
    return { blocked: true, result: { allowed: false, remaining: 0, banned: true } };
  }

  // 2. Auto-expire premium if past premium_until date
  await checkAndExpirePremium(telegramId);

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
