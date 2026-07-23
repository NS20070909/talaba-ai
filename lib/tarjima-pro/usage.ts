import { guardCheck, getOrResetUsage, canUseTranslation, incrementTranslation } from "@/lib/limit-checker";
import { getUser } from "@/lib/storage";
import type { PlanType } from "@/lib/user";
import { getTranslationLimits } from "./constants";
import type { UsageInfo } from "./types";

export async function getTarjimaUsageInfo(telegramId: number): Promise<UsageInfo> {
  const user = await getUser(telegramId);
  const plan: PlanType = user?.plan ?? "FREE";
  const limits = getTranslationLimits(plan);
  const stats = await getOrResetUsage(telegramId);
  const used = limits.dailyLimit === Infinity ? 0 : stats.translationUsedToday;

  return {
    plan,
    used,
    limit: limits.dailyLimit === Infinity ? 0 : limits.dailyLimit,
    isUnlimited: limits.dailyLimit === Infinity,
    maxPages: limits.maxPages,
    maxFileMb: Math.round(limits.maxFileBytes / (1024 * 1024)),
    maxTextChars: limits.maxTextChars,
    allowPdf: limits.allowPdf,
    allowAcademic: limits.allowAcademic,
  };
}

export async function canUseTarjimaPro(
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

  const result = await canUseTranslation(telegramId);
  return {
    allowed: result.allowed,
    remaining: result.remaining,
    banned: result.banned,
  };
}

export async function incrementTarjimaPro(telegramId: number): Promise<void> {
  const user = await getUser(telegramId);
  const plan: PlanType = user?.plan ?? "FREE";
  const limits = getTranslationLimits(plan);
  if (limits.dailyLimit === Infinity) return;

  await incrementTranslation(telegramId);
}
