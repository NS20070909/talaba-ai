import { User, UsageStats, PlanType } from "./user";

const usersMap = new Map<number, User>();
const usageStatsMap = new Map<number, UsageStats>();

export async function getUser(telegramId: number): Promise<User | null> {
  return usersMap.get(telegramId) || null;
}

export async function createUser(
  telegramId: number,
  firstName: string,
  username?: string,
  plan: PlanType = "FREE"
): Promise<User> {
  const user: User = {
    telegramId,
    firstName,
    username,
    plan,
    premiumUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  usersMap.set(telegramId, user);
  return user;
}

export async function updateUser(
  telegramId: number,
  updates: Partial<Omit<User, "telegramId" | "createdAt" | "updatedAt">>
): Promise<User | null> {
  const user = usersMap.get(telegramId);
  if (!user) return null;
  
  const updatedUser: User = {
    ...user,
    ...updates,
    updatedAt: new Date(),
  };
  usersMap.set(telegramId, updatedUser);
  return updatedUser;
}

export async function getUsageStats(telegramId: number): Promise<UsageStats> {
  let stats = usageStatsMap.get(telegramId);
  if (!stats) {
    stats = {
      telegramId,
      pptUsedToday: 0,
      pdfUsedToday: 0,
      scanUsedToday: 0,
      lastResetDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usageStatsMap.set(telegramId, stats);
  }
  return stats;
}

export async function updateUsageStats(
  telegramId: number,
  updates: Partial<Omit<UsageStats, "telegramId" | "lastResetDate" | "createdAt" | "updatedAt">>
): Promise<UsageStats> {
  const stats = await getUsageStats(telegramId);
  
  const updatedStats: UsageStats = {
    ...stats,
    ...updates,
    updatedAt: new Date(),
  };
  usageStatsMap.set(telegramId, updatedStats);
  return updatedStats;
}

export async function resetUsageStats(telegramId: number): Promise<UsageStats> {
  const stats = usageStatsMap.get(telegramId);
  const createdAt = stats ? stats.createdAt : new Date();
  
  const resetStats: UsageStats = {
    telegramId,
    pptUsedToday: 0,
    pdfUsedToday: 0,
    scanUsedToday: 0,
    lastResetDate: new Date(),
    createdAt,
    updatedAt: new Date(),
  };
  usageStatsMap.set(telegramId, resetStats);
  return resetStats;
}
