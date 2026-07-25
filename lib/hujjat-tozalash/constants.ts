import { PLAN_LIMITS } from "@/lib/limits";
import type { PlanType } from "@/lib/user";
import type { DocumentLimits } from "./types";

/** OTM / university document standards */
export const FONT = "Times New Roman";
export const BODY_SIZE = 28; // 14pt (half-points)
export const TITLE_SIZE = 32; // 16pt
export const HEADING1_SIZE = 28;
export const HEADING2_SIZE = 26;

export const MARGIN_LEFT = 1701; // ~3 cm
export const MARGIN_RIGHT = 851; // ~1.5 cm
export const MARGIN_TOP = 1134; // ~2 cm
export const MARGIN_BOTTOM = 1134;
export const FIRST_LINE_INDENT = 709; // ~1.25 cm

export const FREE_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const PREMIUM_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const FREE_MAX_PAGES = 5;
export const PREMIUM_MAX_PAGES = 100;
export const FREE_DAILY_LIMIT = 2;

export const MIN_TEXT_LENGTH = 20;
export const WORDS_PER_PAGE = 250;

export const GEMINI_MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",

  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",

  "gemini-flash-latest",

  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

export function getDocumentLimits(plan: PlanType): DocumentLimits {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;
  const isPremium = !!limits.unlimited || plan !== "FREE";

  if (limits.unlimited) {
    return {
      maxFileBytes: PREMIUM_MAX_FILE_BYTES,
      maxPages: PREMIUM_MAX_PAGES,
      dailyLimit: Infinity,
      isPremium: true,
    };
  }

  if (plan === "FREE") {
    return {
      maxFileBytes: FREE_MAX_FILE_BYTES,
      maxPages: FREE_MAX_PAGES,
      dailyLimit: FREE_DAILY_LIMIT,
      isPremium: false,
    };
  }

  return {
    maxFileBytes: PREMIUM_MAX_FILE_BYTES,
    maxPages: limits.referatMaxPages ?? 15,
    dailyLimit: limits.referatPerDay ?? FREE_DAILY_LIMIT,
    isPremium: true,
  };
}

export const STAGE_MESSAGES: Record<string, string> = {
  validating: "Hujjat tekshirilmoqda...",
  reading: "Hujjat o'qilmoqda...",
  analyzing: "Tuzilma tahlil qilinmoqda...",
  checking_format: "Format tekshirilmoqda...",
  ai_analysis: "Gemini AI tahlil qilmoqda...",
  cleaning: "Hujjat tozalanmoqda...",
  optimizing: "Tartib optimallashtirilmoqda...",
  generating: "Yangi hujjat yaratilmoqda...",
  verifying: "Sifat tekshirilmoqda...",
  complete: "Tayyor!",
};
