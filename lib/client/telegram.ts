"use client";

export interface TelegramContext {
  id: number | null;
  firstName?: string;
  lastName?: string;
  username?: string;
  initData: string;
  isTelegramWebApp: boolean;
  user?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
}

let isInitialized = false;
let syncInProgress = false;

/**
 * Returns the current Telegram WebApp client context.
 * Priority:
 * 1. window.Telegram.WebApp.initDataUnsafe.user (authoritative source)
 * 2. verified server state / initData string
 * 3. localStorage cache (temporary cache only, never authoritative)
 * 4. URL ?userId as an untrusted navigation hint
 */
export function getTelegramContext(): TelegramContext {
  if (typeof window === "undefined") {
    return {
      id: null,
      initData: "",
      isTelegramWebApp: false,
    };
  }

  const tg = (window as any).Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user;
  const initData = tg?.initData || "";
  const isTelegramWebApp = Boolean(tg && (initData || user));

  if (user && user.id) {
    const numId = Number(user.id);
    if (!isNaN(numId) && numId > 0) {
      try {
        localStorage.setItem("telegram_user_id", String(numId));
      } catch {}
      return {
        id: numId,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        initData,
        isTelegramWebApp: true,
        user: {
          id: numId,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
        },
      };
    }
  }

  // Fallback 1: localStorage cache
  let cachedId: number | null = null;
  try {
    const raw = localStorage.getItem("telegram_user_id");
    if (raw) {
      const parsed = Number(raw);
      if (!isNaN(parsed) && parsed > 0) {
        cachedId = parsed;
      }
    }
  } catch {}

  // Fallback 2: URL ?userId (untrusted bootstrap parameter for backward compatibility)
  if (!cachedId) {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlUserId = params.get("userId");
      if (urlUserId) {
        const parsed = Number(urlUserId);
        if (!isNaN(parsed) && parsed > 0) {
          cachedId = parsed;
        }
      }
    } catch {}
  }

  return {
    id: cachedId,
    initData,
    isTelegramWebApp,
    user: cachedId ? { id: cachedId } : undefined,
  };
}

/**
 * Dispatches a request to /api/sync-user using verified initData.
 */
async function syncUserWithBackend(initData: string) {
  if (!initData || syncInProgress) return;
  if (sessionStorage.getItem("tg_synced_data") === initData) {
    return; // Already synced this session
  }

  syncInProgress = true;
  try {
    const res = await fetch("/api/sync-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": initData,
      },
      body: JSON.stringify({ init_data: initData }),
    });
    if (res.ok) {
      sessionStorage.setItem("tg_synced_data", initData);
    }
  } catch (err) {
    console.warn("[Telegram Client] User sync failed:", err);
  } finally {
    syncInProgress = false;
  }
}

/**
 * Initializes Telegram WebApp safely without race conditions.
 * Retries every 100ms up to 6 seconds if external script is still loading.
 */
export function initTelegramWebApp(): () => void {
  if (typeof window === "undefined" || isInitialized) {
    return () => {};
  }

  let attempts = 0;
  const maxAttempts = 60; // 60 * 100ms = 6.0 seconds

  const timer = setInterval(() => {
    attempts++;
    const tg = (window as any).Telegram?.WebApp;

    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch {}

      const ctx = getTelegramContext();
      if (ctx.id) {
        clearInterval(timer);
        isInitialized = true;

        // Dispatch central event so all listening widgets refresh seamlessly
        try {
          window.dispatchEvent(new CustomEvent("telegram-user-ready", { detail: ctx }));
        } catch {}

        if (ctx.initData) {
          syncUserWithBackend(ctx.initData);
        }
        return;
      }
    }

    if (attempts >= maxAttempts) {
      clearInterval(timer);
      const fallbackCtx = getTelegramContext();
      if (fallbackCtx.id) {
        try {
          window.dispatchEvent(new CustomEvent("telegram-user-ready", { detail: fallbackCtx }));
        } catch {}
      }
    }
  }, 100);

  return () => {
    clearInterval(timer);
  };
}
