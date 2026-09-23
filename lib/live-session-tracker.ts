import { getSupabase } from "./supabase";
import { canUseLive, incrementLiveSeconds } from "./limit-checker";

export interface LiveSessionRecord {
  id: string;
  telegramId: number;
  startedAt: number; // Unix ms
  lastHeartbeatAt: number; // Unix ms
  creditedSeconds: number;
  status: "active" | "ended" | "exhausted";
  endedAt?: number;
}

declare global {
  var __talaba_live_sessions__: Map<string, LiveSessionRecord> | undefined;
}

// In-memory fast-access store for active sessions (shared across Next.js route bundles)
const memorySessions: Map<string, LiveSessionRecord> =
  globalThis.__talaba_live_sessions__ ||
  (globalThis.__talaba_live_sessions__ = new Map<string, LiveSessionRecord>());

// Helper to safely interact with Supabase live_sessions table if it exists
async function persistSessionDb(session: LiveSessionRecord): Promise<void> {
  try {
    const supabase = getSupabase();
    await supabase.from("live_sessions").upsert(
      {
        id: session.id,
        telegram_id: session.telegramId,
        started_at: new Date(session.startedAt).toISOString(),
        last_heartbeat_at: new Date(session.lastHeartbeatAt).toISOString(),
        ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : null,
        credited_seconds: session.creditedSeconds,
        status: session.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch (err: any) {
    // Non-fatal if table not yet migrated; in-memory store maintains state
    console.debug?.("[Live Session Tracker] DB upsert notice:", err?.message || err);
  }
}

async function fetchSessionDb(sessionId: string): Promise<LiveSessionRecord | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      telegramId: Number(data.telegram_id),
      startedAt: new Date(data.started_at).getTime(),
      lastHeartbeatAt: new Date(data.last_heartbeat_at).getTime(),
      creditedSeconds: data.credited_seconds ?? 0,
      status: data.status,
      endedAt: data.ended_at ? new Date(data.ended_at).getTime() : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Creates and registers a new Live audio session with a unique ID.
 */
export async function createLiveSession(telegramId: number): Promise<{ sessionId: string; startedAt: number }> {
  const sessionId = crypto.randomUUID();
  const now = Date.now();

  const record: LiveSessionRecord = {
    id: sessionId,
    telegramId,
    startedAt: now,
    lastHeartbeatAt: now,
    creditedSeconds: 0,
    status: "active",
  };

  memorySessions.set(sessionId, record);
  // Persist to DB in background
  persistSessionDb(record).catch(() => undefined);

  return { sessionId, startedAt: now };
}

/**
 * Retrieves a session by ID (from memory first, then DB fallback).
 */
export async function getLiveSession(sessionId: string): Promise<LiveSessionRecord | null> {
  const inMemory = memorySessions.get(sessionId);
  if (inMemory) return inMemory;

  const fromDb = await fetchSessionDb(sessionId);
  if (fromDb) {
    memorySessions.set(fromDb.id, fromDb);
    return fromDb;
  }

  return null;
}

/**
 * Processes an incoming 30-second heartbeat from the client.
 * Strictly prevents double deduction and verifies remaining daily limit.
 */
export async function recordLiveHeartbeat(
  sessionId: string,
  telegramId: number
): Promise<{
  success: boolean;
  limitReached?: boolean;
  remainingSeconds: number;
  creditedSeconds: number;
  error?: string;
}> {
  const session = await getLiveSession(sessionId);
  if (!session) {
    return { success: false, remainingSeconds: 0, creditedSeconds: 0, error: "Sessiya topilmadi." };
  }

  if (session.telegramId !== telegramId) {
    return { success: false, remainingSeconds: 0, creditedSeconds: 0, error: "Ruxsat berilmadi." };
  }

  if (session.status === "ended") {
    const liveStatus = await canUseLive(telegramId);
    return {
      success: true,
      remainingSeconds: liveStatus.remainingSeconds,
      creditedSeconds: session.creditedSeconds,
    };
  }

  const now = Date.now();
  session.lastHeartbeatAt = now;

  // Calculate actual elapsed seconds since session start
  const totalElapsedSeconds = Math.max(0, Math.floor((now - session.startedAt) / 1000));
  const uncreditedDelta = totalElapsedSeconds - session.creditedSeconds;

  const currentStatus = await canUseLive(telegramId);

  // If already exhausted or no uncredited delta, do not increment
  if (currentStatus.remainingSeconds <= 0) {
    session.status = "exhausted";
    persistSessionDb(session).catch(() => undefined);
    return {
      success: true,
      limitReached: true,
      remainingSeconds: 0,
      creditedSeconds: session.creditedSeconds,
    };
  }

  // Idempotency: only credit positive delta
  if (uncreditedDelta > 0) {
    const secondsToCredit = Math.min(uncreditedDelta, currentStatus.remainingSeconds);
    session.creditedSeconds += secondsToCredit;
    await incrementLiveSeconds(telegramId, secondsToCredit);

    persistSessionDb(session).catch(() => undefined);

    const updatedRemaining = Math.max(0, currentStatus.remainingSeconds - secondsToCredit);
    if (updatedRemaining <= 0) {
      session.status = "exhausted";
      persistSessionDb(session).catch(() => undefined);
      return {
        success: true,
        limitReached: true,
        remainingSeconds: 0,
        creditedSeconds: session.creditedSeconds,
      };
    }

    return {
      success: true,
      limitReached: false,
      remainingSeconds: updatedRemaining,
      creditedSeconds: session.creditedSeconds,
    };
  }

  return {
    success: true,
    limitReached: false,
    remainingSeconds: currentStatus.remainingSeconds,
    creditedSeconds: session.creditedSeconds,
  };
}

/**
 * Concludes a Live session safely:
 * - Computes real server-verified elapsed duration (does not trust client-spoofed numbers).
 * - Only debits the uncredited difference (guaranteeing zero double deduction).
 * - Marks the session as ended.
 */
export async function endLiveSession(
  sessionId: string,
  telegramId: number,
  clientDurationSeconds?: number
): Promise<{
  success: boolean;
  totalCreditedSeconds: number;
  remainingSeconds: number;
  error?: string;
}> {
  const session = await getLiveSession(sessionId);
  if (!session) {
    // Fallback if session ID wasn't found: clamp client duration safely
    const liveStatus = await canUseLive(telegramId);
    return {
      success: true,
      totalCreditedSeconds: 0,
      remainingSeconds: liveStatus.remainingSeconds,
    };
  }

  if (session.telegramId !== telegramId) {
    return { success: false, totalCreditedSeconds: session.creditedSeconds, remainingSeconds: 0, error: "Ruxsat berilmadi." };
  }

  const liveStatus = await canUseLive(telegramId);

  // If session already concluded, zero extra deduction (idempotent!)
  if (session.status === "ended") {
    return {
      success: true,
      totalCreditedSeconds: session.creditedSeconds,
      remainingSeconds: liveStatus.remainingSeconds,
    };
  }

  const now = Date.now();
  session.endedAt = now;
  session.status = "ended";

  // Server-authoritative duration calculation:
  // Duration between start and end on the server
  const serverDuration = Math.max(0, Math.floor((now - session.startedAt) / 1000));

  // Determine authoritative duration:
  // If client sent duration, clamp it:
  // - Cannot be less than what heartbeats already proved and credited
  // - Cannot be larger than serverDuration (protects against client sending 999999)
  // - If client sends 1 when server knows 60s elapsed, server enforces at least the heartbeats/serverDuration
  let finalDuration: number;
  if (typeof clientDurationSeconds === "number" && !isNaN(clientDurationSeconds)) {
    const clampedClient = Math.round(clientDurationSeconds);
    // Bounded between credited heartbeats and server elapsed time + 2s clock skew grace
    finalDuration = Math.min(serverDuration + 2, Math.max(session.creditedSeconds, clampedClient));
  } else {
    finalDuration = serverDuration;
  }

  const uncreditedDifference = Math.max(0, finalDuration - session.creditedSeconds);

  if (uncreditedDifference > 0 && liveStatus.remainingSeconds > 0) {
    const secondsToCredit = Math.min(uncreditedDifference, liveStatus.remainingSeconds);
    session.creditedSeconds += secondsToCredit;
    await incrementLiveSeconds(telegramId, secondsToCredit);
  }

  persistSessionDb(session).catch(() => undefined);

  const finalStatus = await canUseLive(telegramId);
  return {
    success: true,
    totalCreditedSeconds: session.creditedSeconds,
    remainingSeconds: finalStatus.remainingSeconds,
  };
}

/** Helper to reset in-memory tracker state (used by test suites) */
export function resetLiveSessionTracker(): void {
  memorySessions.clear();
}
