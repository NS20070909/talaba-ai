import { PLAN_LIMITS } from "@/lib/limits";
import type { PlanType } from "@/lib/user";
import type { LangCode, TranslationLimits } from "./types";

export const FREE_DAILY_LIMIT = 2;
export const FREE_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PREMIUM_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const FREE_MAX_PAGES = 5;
export const PREMIUM_MAX_PAGES = 100;
export const FREE_MAX_TEXT_CHARS = 5000;
export const PREMIUM_MAX_TEXT_CHARS = 50000;
export const WORDS_PER_PAGE = 250;
export const MIN_TEXT_LENGTH = 10;
export const BATCH_SIZE = 25;

export const LANG_LABELS: Record<LangCode, string> = {
  uz: "O'zbek",
  en: "Ingliz",
  ru: "Rus",
};

/** Tez matn tarjimasi */
export const FAST_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
];

/** Standart hujjat tarjimasi */
export const STANDARD_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
];

/** Akademik / murakkab tarjima (Premium) */
export const ACADEMIC_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

export function getTranslationLimits(plan: PlanType): TranslationLimits {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
  const isPremium = !!limits.unlimited || plan !== "FREE";

  if (limits.unlimited) {
    return {
      maxFileBytes: PREMIUM_MAX_FILE_BYTES,
      maxPages: PREMIUM_MAX_PAGES,
      maxTextChars: PREMIUM_MAX_TEXT_CHARS,
      dailyLimit: Infinity,
      isPremium: true,
      allowPdf: true,
      allowAcademic: true,
    };
  }

  if (plan === "FREE") {
    return {
      maxFileBytes: FREE_MAX_FILE_BYTES,
      maxPages: FREE_MAX_PAGES,
      maxTextChars: FREE_MAX_TEXT_CHARS,
      dailyLimit: FREE_DAILY_LIMIT,
      isPremium: false,
      allowPdf: false,
      allowAcademic: false,
    };
  }

  return {
    maxFileBytes: PREMIUM_MAX_FILE_BYTES,
    maxPages: limits.referatMaxPages ?? 15,
    maxTextChars: PREMIUM_MAX_TEXT_CHARS,
    dailyLimit: limits.translationPerDay ?? limits.referatPerDay ?? FREE_DAILY_LIMIT,
    isPremium: true,
    allowPdf: true,
    allowAcademic: true,
  };
}
