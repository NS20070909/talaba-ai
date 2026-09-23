export interface PlanLimits {
  durationDays?: number;
  pptPerDay?: number;
  pdfPerDay?: number;
  scanPerDay?: number;
  referatPerDay?: number;
  translationPerDay?: number;
  quizPerDay?: number;
  referatMinPages?: number;
  referatMaxPages?: number;
  liveMinutesPerDay?: number;
  flashReviewPerDay?: number;
  chatUnlimited?: boolean;
  unlimited?: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  // ── Legacy plans (kept for backward compatibility) ──────────────────────
  FREE: {
    pptPerDay: 2,
    pdfPerDay: 2,
    scanPerDay: 2,
    referatPerDay: 2,
    translationPerDay: 2,
    quizPerDay: 5,
    referatMinPages: 3,
    referatMaxPages: 7,
    liveMinutesPerDay: 20,
    flashReviewPerDay: 5,
    chatUnlimited: true,
  },
  STARTER: {
    durationDays: 15,
    pptPerDay: 6,
    pdfPerDay: 6,
    scanPerDay: 6,
    referatPerDay: 10,
    translationPerDay: 6,
    referatMinPages: 5,
    referatMaxPages: 10,
    liveMinutesPerDay: 30,
    flashReviewPerDay: 15,
    chatUnlimited: true,
  },
  STUDENT: {
    durationDays: 30,
    pptPerDay: 12,
    pdfPerDay: 12,
    scanPerDay: 12,
    referatPerDay: 50,
    translationPerDay: 12,
    referatMinPages: 5,
    referatMaxPages: 15,
    liveMinutesPerDay: 45,
    flashReviewPerDay: 30,
    chatUnlimited: true,
  },
  PRO: {
    durationDays: 30,
    pptPerDay: 30,
    pdfPerDay: 30,
    scanPerDay: 30,
    referatPerDay: 400,
    translationPerDay: 30,
    referatMinPages: 5,
    referatMaxPages: 30,
    liveMinutesPerDay: 60,
    flashReviewPerDay: 60,
    chatUnlimited: true,
  },
  PREMIUM: {
    unlimited: true,
    referatMinPages: 5,
    referatMaxPages: 50,
    liveMinutesPerDay: 60,
    flashReviewPerDay: 999,
    chatUnlimited: true,
  },

  // ── New duration-based plans ─────────────────────────────────────────────
  DAY: {
    durationDays: 1,
    scanPerDay: 5,
    pptPerDay: 3,
    pdfPerDay: 5,
    referatPerDay: 10,
    translationPerDay: 5,
    referatMinPages: 5,
    referatMaxPages: 10,
    liveMinutesPerDay: 30,
    flashReviewPerDay: 15,
    chatUnlimited: true,
  },
  WEEK: {
    durationDays: 7,
    scanPerDay: 50,
    pptPerDay: 20,
    pdfPerDay: 50,
    referatPerDay: 50,
    translationPerDay: 50,
    referatMinPages: 5,
    referatMaxPages: 15,
    liveMinutesPerDay: 45,
    flashReviewPerDay: 30,
    chatUnlimited: true,
  },
  MONTH: {
    durationDays: 30,
    scanPerDay: 300,
    pptPerDay: 120,
    pdfPerDay: 300,
    referatPerDay: 120,
    translationPerDay: 300,
    referatMinPages: 5,
    referatMaxPages: 50,
    liveMinutesPerDay: 60,
    flashReviewPerDay: 60,
    chatUnlimited: true,
  },
  QUARTER: {
    durationDays: 90,
    scanPerDay: 1000,
    pptPerDay: 400,
    pdfPerDay: 1000,
    referatPerDay: 400,
    translationPerDay: 1000,
    referatMinPages: 5,
    referatMaxPages: 30,
    liveMinutesPerDay: 60,
    flashReviewPerDay: 100,
    chatUnlimited: true,
  },
  YEAR: {
    durationDays: 365,
    unlimited: true,
    referatMinPages: 5,
    referatMaxPages: 50,
    liveMinutesPerDay: 60,
    flashReviewPerDay: 999,
    chatUnlimited: true,
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
