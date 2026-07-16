export interface PlanLimits {
  durationDays?: number;
  pptPerDay?: number;
  pdfPerDay?: number;
  scanPerDay?: number;
  referatPerDay?: number;
  referatMaxPages?: number;
  unlimited?: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  // ── Legacy plans (kept for backward compatibility) ──────────────────────
  FREE: {
    pptPerDay: 2,
    pdfPerDay: 2,
    scanPerDay: 2,
    referatPerDay: 2,
    referatMaxPages: 4,
  },
  STARTER: {
    durationDays: 15,
    pptPerDay: 6,
    pdfPerDay: 6,
    scanPerDay: 6,
    referatPerDay: 10,
    referatMaxPages: 15,
  },
  STUDENT: {
    durationDays: 30,
    pptPerDay: 12,
    pdfPerDay: 12,
    scanPerDay: 12,
    referatPerDay: 30,
    referatMaxPages: 15,
  },
  PRO: {
    durationDays: 30,
    pptPerDay: 30,
    pdfPerDay: 30,
    scanPerDay: 30,
    referatPerDay: 120,
    referatMaxPages: 15,
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
    referatPerDay: 10,
    referatMaxPages: 15,
  },
  WEEK: {
    durationDays: 7,
    scanPerDay: 50,
    pptPerDay: 20,
    pdfPerDay: 50,
    referatPerDay: 50,
    referatMaxPages: 15,
  },
  MONTH: {
    durationDays: 30,
    scanPerDay: 300,
    pptPerDay: 120,
    pdfPerDay: 300,
    referatPerDay: 120,
    referatMaxPages: 15,
  },
  QUARTER: {
    durationDays: 90,
    scanPerDay: 1000,
    pptPerDay: 400,
    pdfPerDay: 1000,
    referatPerDay: 400,
    referatMaxPages: 15,
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
