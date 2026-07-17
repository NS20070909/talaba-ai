
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

// PDF LIMITI UCHUN (Avvalgi funksiyalar)

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
