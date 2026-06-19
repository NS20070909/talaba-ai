export interface PlanLimits {
  durationDays?: number;
  pptPerDay?: number;
  pdfPerDay?: number;
  scanPerDay?: number;
  unlimited?: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  // ── Legacy plans (kept for backward compatibility) ──────────────────────
  FREE: {
    pptPerDay: 2,
    pdfPerDay: 2,
    scanPerDay: 2,
  },
  STARTER: {
    durationDays: 15,
    pptPerDay: 6,
    pdfPerDay: 6,
    scanPerDay: 6,
  },
  STUDENT: {
    durationDays: 30,
    pptPerDay: 12,
    pdfPerDay: 12,
    scanPerDay: 12,
  },
  PRO: {
    durationDays: 30,
    pptPerDay: 30,
    pdfPerDay: 30,
    scanPerDay: 30,
  },
  PREMIUM: {
    unlimited: true,
  },

  // ── New duration-based plans ─────────────────────────────────────────────
  DAY: {
    durationDays: 1,
    scanPerDay: 5,
    pptPerDay: 3,
    pdfPerDay: 5,
  },
  WEEK: {
    durationDays: 7,
    scanPerDay: 50,
    pptPerDay: 20,
    pdfPerDay: 50,
  },
  MONTH: {
    durationDays: 30,
    scanPerDay: 300,
    pptPerDay: 120,
    pdfPerDay: 300,
  },
  QUARTER: {
    durationDays: 90,
    scanPerDay: 1000,
    pptPerDay: 400,
    pdfPerDay: 1000,
  },
  YEAR: {
    durationDays: 365,
    unlimited: true,
  },
};

/** Duration in days for each paid plan (used by /givepremium) */
export const PLAN_DURATION_DAYS: Record<string, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  QUARTER: 90,
  YEAR: 365,
};
