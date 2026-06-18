export type PlanType =
  | "FREE"
  | "STARTER"
  | "STUDENT"
  | "PRO"
  | "PREMIUM";

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