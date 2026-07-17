
// lib/limit-checker.ts

import { NextRequest } from "next/server";

// Bu joyda sizning haqiqiy limit tekshiruvi va foydalanish logikangiz bo'ladi.
// Hozircha soddalashtirilgan versiyasini ishlatamiz.

interface LimitCheckResult {
  hasLimitExceeded: boolean;
  message: string;
  allowed?: boolean;
  banned?: boolean;
}

// REFERAT LIMITI UCHUN
const USER_REFERAT_LIMIT = 5; // Misol uchun, bitta foydalanuvchi 5 ta referat yaratishi mumkin
let currentUserReferatCount = 0; // Bu real dasturda ma'lumotlar bazasidan olinadi

export const checkReferatLimitAndUsage = async (
  req: NextRequest,
  increment: boolean = false
): Promise<LimitCheckResult> => {
  // Real ilovada, bu yerda foydalanuvchining ID si orqali uning limitini tekshirasiz
  // va ma'lumotlar bazasidan foydalanish sonini olasiz.

  // Foydalanuvchi ID sini req.headers dan olish mumkin, masalan.
  // const userId = req.headers.get("x-user-id");

  if (increment) {
    currentUserReferatCount++;
  }

  if (currentUserReferatCount >= USER_REFERAT_LIMIT) {
    return {
      hasLimitExceeded: true,
      message: "Sizning referat yaratish limitingiz tugagan. Keyingi oyda yana urinib ko'ring."
    };
  }

  return {
    hasLimitExceeded: false,
    message: "Limit doirasida."
  };
};

// PDF LIMITI UCHUN

interface GuardCheckResult {
  blocked: boolean;
  result?: { banned: boolean };
}

let userPdfCounts: { [key: number]: number } = {};
let bannedUsers: { [key: number]: boolean } = {};

export const guardCheck = async (userId: number): Promise<GuardCheckResult> => {
  // Real ilovada, bu yerda foydalanuvchining bloklanganligini tekshirasiz
  // va ma'lumotlar bazasidan olasiz.
  return {
    blocked: bannedUsers[userId] || false,
    result: { banned: bannedUsers[userId] || false },
  };
};

export const canUsePDF = async (userId: number): Promise<{
  allowed: boolean;
  message?: string;
}> => {
  // Real ilovada, bu yerda foydalanuvchining kunlik PDF limitini tekshirasiz.
  const today = new Date().toDateString();
  if (!userPdfCounts[userId]) {
    userPdfCounts[userId] = 0;
  }

  // Misol uchun, kunlik 3 ta PDF limiti
  const PDF_DAILY_LIMIT = 3;

  if (userPdfCounts[userId] >= PDF_DAILY_LIMIT) {
    return {
      allowed: false,
      message: "Sizning kunlik PDF limiti tugagan."
    };
  }

  return { allowed: true };
};

export const incrementPDF = async (userId: number): Promise<void> => {
  // Real ilovada, bu yerda foydalanuvchining PDF foydalanish sonini oshirasiz.
  if (!userPdfCounts[userId]) {
    userPdfCounts[userId] = 0;
  }
  userPdfCounts[userId]++;
  console.log(`User ${userId} PDF count: ${userPdfCounts[userId]}`);
};

// PPT LIMITI UCHUN
const USER_PPT_LIMIT = 3; // Misol uchun, bitta foydalanuvchi 3 ta PPT yaratishi mumkin
let currentUserPptCount = 0; // Bu real dasturda ma'lumotlar bazasidan olinadi

export const canUsePPT = async (userId: number): Promise<{
  allowed: boolean;
  message?: string;
}> => {
  if (currentUserPptCount >= USER_PPT_LIMIT) {
    return {
      allowed: false,
      message: "Sizning kunlik PPT yaratish limiti tugagan."
    };
  }
  return { allowed: true };
};

export const incrementPPT = async (userId: number): Promise<void> => {
  currentUserPptCount++;
  console.log(`User ${userId} PPT count: ${currentUserPptCount}`);
};

// SCAN LIMITI UCHUN
let userScanCounts: { [key: number]: number } = {};

export const canUseScan = async (userId: number): Promise<{
  allowed: boolean;
  message?: string;
}> => {
  // Real ilovada, bu yerda foydalanuvchining kunlik Scan limitini tekshirasiz.
  if (!userScanCounts[userId]) {
    userScanCounts[userId] = 0;
  }

  // Misol uchun, kunlik 3 ta Scan limiti
  const SCAN_DAILY_LIMIT = 3;

  if (userScanCounts[userId] >= SCAN_DAILY_LIMIT) {
    return {
      allowed: false,
      message: "Sizning kunlik Scan limiti tugagan.",
    };
  }

  return { allowed: true };
};

export const incrementScan = async (userId: number): Promise<void> => {
  // Real ilovada, bu yerda foydalanuvchining Scan foydalanish sonini oshirasiz.
  if (!userScanCounts[userId]) {
    userScanCounts[userId] = 0;
  }
  userScanCounts[userId]++;
  console.log(`User ${userId} Scan count: ${userScanCounts[userId]}`);
};

// UMUMIY STATISTIKA (daily usage)
interface DailyUsageStats {
  pptUsedToday: number;
  pdfUsedToday: number;
  scanUsedToday: number;
  referatUsedToday: number;
}

export const getOrResetUsage = async (userId: number): Promise<DailyUsageStats> => {
  // Real ilovada bu yerda kun asosida reset bilan ma'lumotlar bazasidan o'qiladi.
  return {
    pptUsedToday: currentUserPptCount,
    pdfUsedToday: userPdfCounts[userId] || 0,
    scanUsedToday: userScanCounts[userId] || 0,
    referatUsedToday: currentUserReferatCount,
  };
};
