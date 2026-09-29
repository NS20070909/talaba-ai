import crypto from "crypto";

export interface VerifiedTelegramUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
}

export interface TelegramAuthResult {
  valid: boolean;
  userId?: number;
  user?: VerifiedTelegramUser;
  authDate?: number;
  error?: string;
}

/**
 * Validates Telegram WebApp initData HMAC-SHA256 signature using timing-safe comparison.
 * 
 * Rules:
 * 1. Extract hash from URLSearchParams.
 * 2. Remove hash, sort all remaining key=value pairs alphabetically and join with \n.
 * 3. Secret key is HMAC-SHA256 of bot token with key "WebAppData".
 * 4. Calculated hash is HMAC-SHA256 of data_check_string using that secret key.
 * 5. Compare hashes using crypto.timingSafeEqual.
 * 6. Validate auth_date freshness (TTL: 24h default).
 */
export function verifyTelegramWebAppInitData(
  initDataRaw: string,
  options: {
    botToken?: string;
    maxAgeSeconds?: number;
  } = {}
): TelegramAuthResult {
  if (!initDataRaw || typeof initDataRaw !== "string") {
    return { valid: false, error: "MISSING_INIT_DATA" };
  }

  const botToken = options.botToken || process.env.TELEGRAM_BOT_TOKEN || "";
  if (!botToken) {
    // If bot token is not configured on server (e.g. initial dev setup), warn and do not break
    console.warn("[Telegram Auth] TELEGRAM_BOT_TOKEN not configured on server.");
    return { valid: false, error: "BOT_TOKEN_NOT_CONFIGURED" };
  }

  try {
    const urlParams = new URLSearchParams(initDataRaw);
    const hash = urlParams.get("hash");
    if (!hash) {
      return { valid: false, error: "MISSING_HASH" };
    }

    urlParams.delete("hash");

    // Sort parameters alphabetically
    const params: string[] = [];
    urlParams.forEach((val, key) => {
      params.push(`${key}=${val}`);
    });
    params.sort();

    const dataCheckString = params.join("\n");
    const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
    const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    // Timing-safe comparison to prevent timing attacks
    const calcBuf = Buffer.from(calculatedHash, "hex");
    const hashBuf = Buffer.from(hash, "hex");

    if (calcBuf.length !== hashBuf.length || !crypto.timingSafeEqual(calcBuf, hashBuf)) {
      return { valid: false, error: "INVALID_HASH" };
    }

    // Parse user object
    let parsedUser: VerifiedTelegramUser | undefined = undefined;
    const userStr = urlParams.get("user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        parsedUser = {
          id: Number(u.id),
          firstName: u.first_name,
          lastName: u.last_name,
          username: u.username,
          languageCode: u.language_code,
          isPremium: Boolean(u.is_premium),
        };
      } catch {}
    }

    // Validate auth_date freshness
    const authDate = Number(urlParams.get("auth_date") || 0);
    const maxAge = options.maxAgeSeconds ?? 86400; // 24 hours default
    if (authDate > 0) {
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > maxAge) {
        return { valid: false, error: "EXPIRED_INIT_DATA" };
      }
    }

    const userId = parsedUser?.id || Number(urlParams.get("id") || 0) || undefined;

    return {
      valid: true,
      userId,
      user: parsedUser,
      authDate,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "VALIDATION_FAILED";
    return { valid: false, error: errorMsg };
  }
}

/**
 * Extracts and verifies Telegram User from an incoming Next.js API Request.
 * Checks header "x-telegram-init-data", or Authorization "Bearer <initData>", or body init_data.
 */
export async function getVerifiedTelegramUser(
  req: Request,
  bodyData?: Record<string, unknown>
): Promise<{
  authenticated: boolean;
  telegramId?: number;
  user?: VerifiedTelegramUser;
  error?: string;
}> {
  // 1. Check header
  const headerInitData = req.headers.get("x-telegram-init-data");
  let initData = headerInitData;

  // 2. Check Authorization header
  if (!initData) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("TelegramInitData ")) {
      initData = authHeader.replace("TelegramInitData ", "").trim();
    }
  }

  // 3. Check body
  if (!initData && bodyData) {
    const candidate = bodyData.init_data || bodyData.initData;
    if (typeof candidate === "string") {
      initData = candidate;
    }
  }

  if (initData) {
    const result = verifyTelegramWebAppInitData(initData);
    if (result.valid && result.userId) {
      return {
        authenticated: true,
        telegramId: result.userId,
        user: result.user,
      };
    }
    return {
      authenticated: false,
      error: result.error || "INVALID_INIT_DATA",
    };
  }

  // 4. Fallback for server-to-server or development calls with bot secret
  const internalSecret = req.headers.get("x-internal-bot-secret");
  if (internalSecret && process.env.TELEGRAM_BOT_TOKEN && internalSecret === process.env.TELEGRAM_BOT_TOKEN) {
    const fallbackId = Number(bodyData?.telegram_user_id || bodyData?.telegram_id || 0);
    if (fallbackId > 0) {
      return { authenticated: true, telegramId: fallbackId };
    }
  }

  // 5. Fallback in non-production environments for local testing
  if (process.env.NODE_ENV !== "production" || process.env.ALLOW_UNAUTHENTICATED_TELEGRAM === "true") {
    const fallbackId = Number(bodyData?.telegram_user_id || bodyData?.telegram_id || req.headers.get("x-telegram-user-id") || 0);
    if (fallbackId > 0) {
      return { authenticated: true, telegramId: fallbackId };
    }
  }

  return {
    authenticated: false,
    error: "MISSING_INIT_DATA",
  };
}
