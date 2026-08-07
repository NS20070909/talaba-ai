import crypto from "crypto";

/**
 * Validates Telegram WebApp initData HMAC-SHA256 signature
 */
export function validateTelegramWebAppData(
  initDataRaw: string,
  botToken: string = process.env.TELEGRAM_BOT_TOKEN || ""
): { valid: boolean; user?: any; error?: string } {
  if (!initDataRaw || typeof initDataRaw !== "string") {
    return { valid: false, error: "MISSING_INIT_DATA" };
  }

  if (!botToken) {
    // If bot token is not configured on server, bypass strict hash validation to avoid breaking dev environment
    return { valid: true };
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

    if (calculatedHash !== hash) {
      return { valid: false, error: "INVALID_HASH" };
    }

    // Parse user object if present
    const userStr = urlParams.get("user");
    const user = userStr ? JSON.parse(userStr) : undefined;

    // Verify timestamp freshness (max 24 hours)
    const authDate = Number(urlParams.get("auth_date") || 0);
    if (authDate > 0) {
      const now = Math.floor(Date.now() / 1000);
      if (now - authDate > 86400) {
        return { valid: false, error: "EXPIRED_INIT_DATA" };
      }
    }

    return { valid: true, user };
  } catch (err: any) {
    return { valid: false, error: err?.message || "VALIDATION_FAILED" };
  }
}

/**
 * Sanitizes input text to prevent HTML injection in Telegram parse_mode: "HTML"
 */
export function sanitizeHTML(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sanitizes uploaded file names to avoid path traversal or control characters
 */
export function sanitizeFilename(name: string): string {
  if (!name) return "file.txt";
  return name
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[^\w\s\.\-]/gi, "_")
    .trim() || "file.txt";
}

/**
 * Strips internal server stack traces or database errors before sending response
 */
export function sanitizeErrorMessage(err: any): string {
  const msg = String(err?.message || err || "").trim();

  // Hide database / SQL / internal stack details
  if (
    msg.includes("PGRST") ||
    msg.includes("postgres") ||
    msg.includes("supabase") ||
    msg.includes("connection") ||
    msg.includes("EHOSTUNREACH") ||
    msg.includes("ENOTFOUND")
  ) {
    return "Xizmatda vaqtincha xatolik yuz berdi. Iltimos, qayta urinib ko'ring.";
  }

  return msg || "Kutilmagan xatolik yuz berdi.";
}
