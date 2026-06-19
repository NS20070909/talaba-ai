export type PlanType =
  | "FREE"
  // Legacy plan names (kept for backward compatibility)
  | "STARTER"
  | "STUDENT"
  | "PRO"
  | "PREMIUM"
  // New duration-based plan names
  | "DAY"
  | "WEEK"
  | "MONTH"
  | "QUARTER"
  | "YEAR";

export interface User {
  telegramId: number;

  firstName: string;
  username?: string;

  plan: PlanType;

  premiumUntil?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface UsageStats {
  telegramId: number;

  pptUsedToday: number;
  pdfUsedToday: number;
  scanUsedToday: number;

  lastResetDate: Date;

  createdAt: Date;
  updatedAt: Date;
}