import { getUser, getUsageStats, updateUsageStats, resetUsageStats, updateUser } from "./storage";
import { PLAN_LIMITS } from "./limits";
import { UsageStats, PlanType, User } from "./user";
import { isBanned } from "./admin";

interface GuardCacheEntry {
  timestamp: number;
  data: {
    blocked: boolean;
    result?: CheckResult;
    user: User | null;
    stats: UsageStats;
  };
}

// In-memory 3-second request-scoped cache to prevent duplicate roundtrips
const guardCache = new Map<number, GuardCacheEntry>();

export function invalidateGuardCache(telegramId: number): void {
  guardCache.delete(telegramId);
}

// Helper to get stats, resetting them if it's a new day (single DB pass when no reset needed)
export async function getOrResetUsage(telegramId: number): Promise<UsageStats> {
  const stats = await getUsageStats(telegramId);
  const now = new Date();
  const lastReset = new Date(stats.lastResetDate);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (formatter.format(now) !== formatter.format(lastReset)) {
    await resetUsageStats(telegramId);
    return await getUsageStats(telegramId);
  }
  return stats;
}

export async function checkDailyReset(telegramId: number): Promise<void> {
  await getOrResetUsage(telegramId);
}

export interface CheckResult {
  allowed: boolean;
  remaining: number;
  banned?: boolean;
}

// ── Shared guard: runs ban check + premium expiry + daily reset in a single pass ──

export async function guardCheck(telegramId: number): Promise<{
  blocked: boolean;
  result?: CheckResult;
  user: User | null;
  stats: UsageStats;
}> {
  const now = Date.now();
  const cached = guardCache.get(telegramId);
  if (cached && now - cached.timestamp < 3000) {
    return cached.data;
  }

  // 1. Ban check
  const banned = await isBanned(telegramId);
  if (banned) {
    const blockedRes = {
      blocked: true,
      result: { allowed: false, remaining: 0, banned: true },
      user: null,
      stats: null as any,
    };
    guardCache.set(telegramId, { timestamp: now, data: blockedRes });
    return blockedRes;
  }

  // 2. User & auto-expire premium
  let user = await getUser(telegramId);
  if (user && user.plan !== "FREE" && user.premiumUntil) {
    if (new Date() > user.premiumUntil) {
      await updateUser(telegramId, { plan: "FREE", premiumUntil: null });
      user = { ...user, plan: "FREE", premiumUntil: null };
    }
  }

  // 3. Stats & daily reset (single pass)
  const stats = await getOrResetUsage(telegramId);

  const res = {
    blocked: false,
    user,
    stats,
  };
  guardCache.set(telegramId, { timestamp: now, data: res });
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function canUsePPT(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";

  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }

  const stats = guard.stats;
  const limit = limits?.pptPerDay || 0;
  const remaining = Math.max(0, limit - (stats.pptUsedToday || 0));

  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function canUsePDF(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";

  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }

  const stats = guard.stats;
  const limit = limits?.pdfPerDay || 0;
  const remaining = Math.max(0, limit - (stats.pdfUsedToday || 0));

  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function canUseScan(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";

  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }

  const stats = guard.stats;
  const limit = limits?.scanPerDay || 0;
  const remaining = Math.max(0, limit - (stats.scanUsedToday || 0));

  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function incrementPPT(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    pptUsedToday: (stats.pptUsedToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}

export async function incrementPDF(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    pdfUsedToday: (stats.pdfUsedToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}

export async function incrementScan(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    scanUsedToday: (stats.scanUsedToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}

export async function canUseReferat(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";

  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }

  const stats = guard.stats;
  const limit = limits?.referatPerDay || 0;
  const remaining = Math.max(0, limit - (stats.referatUsedToday || 0));

  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function incrementReferat(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    referatUsedToday: (stats.referatUsedToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}

export async function canUseTranslation(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";

  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }

  const stats = guard.stats;
  const limit = limits?.translationPerDay ?? 2;
  const remaining = Math.max(0, limit - (stats.translationUsedToday || 0));

  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function incrementTranslation(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    translationUsedToday: (stats.translationUsedToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}

export async function canUseQuiz(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";

  const limits = PLAN_LIMITS[plan];
  if (limits?.unlimited) {
    return { allowed: true, remaining: Infinity };
  }

  const stats = guard.stats;
  const limit = limits?.quizPerDay ?? 5;
  const remaining = Math.max(0, limit - (stats.quizUsedToday || 0));

  return {
    allowed: remaining > 0,
    remaining,
  };
}

export async function incrementQuiz(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    quizUsedToday: (stats.quizUsedToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}

// ── AI Study Mentor Limits: Live Voice, Flash Review, and AI Chat ─────────

export interface LiveCheckResult {
  allowed: boolean;
  remainingSeconds: number;
  limitMinutes: number;
  usedSeconds: number;
  banned?: boolean;
}

export async function canUseLive(telegramId: number): Promise<LiveCheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) {
    return {
      allowed: false,
      remainingSeconds: 0,
      limitMinutes: 0,
      usedSeconds: 0,
      banned: guard.result?.banned,
    };
  }

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

  const limitMinutes = limits.liveMinutesPerDay ?? 20;
  const limitSeconds = limitMinutes * 60;

  const stats = guard.stats;
  const usedSeconds = stats.liveSecondsToday || 0;
  const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);

  return {
    allowed: remainingSeconds > 0,
    remainingSeconds,
    limitMinutes,
    usedSeconds,
  };
}

export async function incrementLiveSeconds(telegramId: number, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  const stats = await getOrResetUsage(telegramId);
  const current = stats.liveSecondsToday || 0;
  await updateUsageStats(telegramId, {
    liveSecondsToday: current + Math.round(seconds),
  });
  invalidateGuardCache(telegramId);
}

export interface FlashReviewCheckResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  used: number;
  banned?: boolean;
}

export async function canUseFlashReview(telegramId: number): Promise<FlashReviewCheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) {
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      used: 0,
      banned: guard.result?.banned,
    };
  }

  const user = guard.user;
  const plan: PlanType = user ? user.plan : "FREE";
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

  if (limits.unlimited) {
    return {
      allowed: true,
      remaining: Infinity,
      limit: 999,
      used: 0,
    };
  }

  const limit = limits.flashReviewPerDay ?? 5;
  const stats = guard.stats;
  const used = stats.flashReviewUsedToday || 0;
  const remaining = Math.max(0, limit - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit,
    used,
  };
}

export async function incrementFlashReview(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    flashReviewUsedToday: (stats.flashReviewUsedToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}

export async function canUseAiChat(telegramId: number): Promise<CheckResult> {
  const guard = await guardCheck(telegramId);
  if (guard.blocked) return guard.result!;
  // AI Chat is user-facing unlimited for both FREE and PREMIUM users
  return {
    allowed: true,
    remaining: Infinity,
  };
}

export async function incrementAiChatMessages(telegramId: number): Promise<void> {
  const stats = await getOrResetUsage(telegramId);
  await updateUsageStats(telegramId, {
    chatMessagesToday: (stats.chatMessagesToday || 0) + 1,
  });
  invalidateGuardCache(telegramId);
}
