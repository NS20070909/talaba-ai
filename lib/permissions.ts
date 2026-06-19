import { isOwner, isAdmin, isBanned } from "./admin";

export class PermissionError extends Error {
  constructor(public code: "NOT_OWNER" | "NOT_ADMIN" | "BANNED", message: string) {
    super(message);
    this.name = "PermissionError";
  }
}

/**
 * Asserts that the telegramId belongs to the owner.
 * Throws a PermissionError if not.
 */
export function assertOwner(telegramId: number | string): void {
  const numId = typeof telegramId === "string" ? Number(telegramId) : telegramId;
  if (!isOwner(numId)) {
    throw new PermissionError("NOT_OWNER", "This action requires owner privileges.");
  }
}

/**
 * Asserts that the telegramId belongs to an admin (or the owner).
 * Throws a PermissionError if not.
 */
export async function assertAdmin(telegramId: number | string): Promise<void> {
  const numId = typeof telegramId === "string" ? Number(telegramId) : telegramId;
  
  if (await isBanned(numId)) {
    throw new PermissionError("BANNED", "User is banned from the platform.");
  }

  if (!(await isAdmin(numId))) {
    throw new PermissionError("NOT_ADMIN", "This action requires admin privileges.");
  }
}

/**
 * Asserts that the telegramId is not banned.
 * Throws a PermissionError if banned.
 */
export async function assertNotBanned(telegramId: number | string): Promise<void> {
  const numId = typeof telegramId === "string" ? Number(telegramId) : telegramId;
  if (await isBanned(numId)) {
    throw new PermissionError("BANNED", "User is banned from the platform.");
  }
}

/**
 * Check-style permission helpers that return boolean instead of throwing.
 */
export async function checkPermissions(telegramId: number | string): Promise<{
  isOwner: boolean;
  isAdmin: boolean;
  isBanned: boolean;
  canAccess: boolean;
}> {
  const numId = typeof telegramId === "string" ? Number(telegramId) : telegramId;
  const owner = isOwner(numId);
  const banned = await isBanned(numId);
  const admin = await isAdmin(numId);

  return {
    isOwner: owner,
    isAdmin: admin,
    isBanned: banned,
    canAccess: !banned,
  };
}
