
// lib/limit-checker.ts

// Bu joyda sizning haqiqiy limit tekshiruvi va foydalanish logikangiz bo'ladi.
import { NextRequest } from "next/server";

// Hozircha soddalashtirilgan versiyasini ishlatamiz.

interface LimitCheckResult {
  hasLimitExceeded: boolean;
  message: string;
}

const USER_REFERAT_LIMIT = 5; // Misol uchun, bitta foydalanuvchi 5 ta referat yaratishi mumkin
let currentUserReferatCount = 0; // Bu real dasturda ma'lumotlar bazasidan olinadi

export const checkReferatLimitAndUsage = async (
  req: NextRequest,
  increment: boolean = false
): Promise<LimitCheckResult> => {
  // Real ilovada, bu yerda foydalanuvchining ID si orqali uning limitini tekshirasiz
  // va ma'lumotlar bazasidan foydalanish sonini olasiz.

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
