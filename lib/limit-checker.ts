import { getUser, getUsageStats, updateUsageStats, resetUsageStats } from "./storage";
import { PLAN_LIMITS } from "./limits";
import { UsageStats, PlanType } from "./user";

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
}

export async function canUsePPT(telegramId: number): Promise<CheckResult> {
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
