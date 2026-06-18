export interface PlanLimits {
  durationDays?: number;
  pptPerDay?: number;
  pdfPerDay?: number;
  scanPerDay?: number;
  unlimited?: boolean;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
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
};
