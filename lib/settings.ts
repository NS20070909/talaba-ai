import { getSupabase } from "./supabase";
import { recordAuditLog } from "./audit-log";
import { isOwner } from "./admin-management";

export interface SettingRecord {
  key: string;
  value: any;
  category: string;
  updated_by: number | null;
  updated_at: string;
}

export const DEFAULT_SETTINGS: Record<string, { category: string; value: any }> = {
  bot_name: { category: "bot", value: "Talaba AI Bot" },
  bot_username: { category: "bot", value: "talaba_ai_bot" },
  support_username: { category: "bot", value: "Narkabilov_S_07" },
  maintenance_mode: { category: "bot", value: false },
  welcome_message: { category: "bot", value: "Assalomu alaykum! Talaba AI botiga xush kelibsiz." },

  card_holder: { category: "payment", value: "Sirojiddin Narkabilov" },
  card_number: { category: "payment", value: "8600 0000 0000 0000" },
  payment_instructions: { category: "payment", value: "To`lovni amalga oshirgach, chek rasmini yuboring." },

  tariffs: { category: "premium", value: { STARTER: 2900, WEEKLY: 11900, PREMIUM: 29900 } },
  daily_limits: { category: "premium", value: { FREE: { scan: 3, ppt: 1, pdf: 3 }, PREMIUM: { scan: 300, ppt: 120, pdf: 300 } } },

  notify_payment: { category: "notifications", value: true },
  notify_broadcast: { category: "notifications", value: true },
  notify_support: { category: "notifications", value: true },

  default_ai_model: { category: "ai", value: "gemini-1.5-flash" },
  ai_timeout: { category: "ai", value: 30000 },
  ai_retry_count: { category: "ai", value: 3 },

  timezone: { category: "system", value: "Asia/Tashkent" },
  default_language: { category: "system", value: "uz" },
  file_upload_limit_mb: { category: "system", value: 20 },
};

export async function getSystemSettings(category?: string): Promise<Record<string, any>> {
  const supabase = getSupabase();
  let query = supabase.from("system_settings").select("*");

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error || !data) return {};

  const settings: Record<string, any> = {};
  data.forEach((row) => {
    settings[row.key] = row.value;
  });

  return settings;
}

export async function getSettingByKey<T>(key: string, defaultValue?: T): Promise<T> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) {
    const fallback = DEFAULT_SETTINGS[key]?.value;
    return (fallback !== undefined ? fallback : defaultValue) as T;
  }
  return data.value as T;
}

export async function updateSystemSetting(
  key: string,
  value: any,
  category: string,
  adminId: number
): Promise<void> {
  const oldValue = await getSettingByKey(key);
  const supabase = getSupabase();

  const { error } = await supabase.from("system_settings").upsert(
    {
      key,
      value,
      category,
      updated_by: adminId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    console.error("updateSystemSetting error:", error);
    throw error;
  }

  await recordAuditLog({
    adminId,
    action: "SETTINGS_UPDATED",
    target: key,
    description: `Updated setting '${key}' in category '${category}'`,
    oldValue: { [key]: oldValue },
    newValue: { [key]: value },
  });
}

export async function updateSettingsBatch(
  settings: Array<{ key: string; value: any; category: string }>,
  adminId: number
): Promise<void> {
  const supabase = getSupabase();
  const oldMap = await getSystemSettings();

  const rows = settings.map((s) => ({
    key: s.key,
    value: s.value,
    category: s.category,
    updated_by: adminId,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });

  if (error) {
    console.error("updateSettingsBatch error:", error);
    throw error;
  }

  const oldValues: Record<string, any> = {};
  const newValues: Record<string, any> = {};
  settings.forEach((s) => {
    oldValues[s.key] = oldMap[s.key];
    newValues[s.key] = s.value;
  });

  await recordAuditLog({
    adminId,
    action: "SETTINGS_UPDATED",
    target: "SYSTEM",
    description: `Updated ${settings.length} system setting(s)`,
    oldValue: oldValues,
    newValue: newValues,
  });
}

export async function restoreDefaultSetting(
  key: string,
  adminId: number
): Promise<any> {
  if (!isOwner(adminId)) {
    throw new Error("UNAUTHORIZED_OWNER_ONLY: Only Owner can restore default settings.");
  }

  const def = DEFAULT_SETTINGS[key];
  if (!def) {
    throw new Error(`NO_DEFAULT_FOUND: Default setting for '${key}' not found.`);
  }

  await updateSystemSetting(key, def.value, def.category, adminId);
  return def.value;
}
