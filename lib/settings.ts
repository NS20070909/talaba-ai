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

// In-memory fallback cache in case Supabase schema cache hasn't refreshed or table is missing
const inMemoryCache: Record<string, any> = {
  card_holder: "Sirojiddin Narkabilov",
  card_number: "8600 0000 0000 0000",
  maintenance_mode: false,
};

export const DEFAULT_SETTINGS: Record<string, { category: string; value: any }> = {
  card_holder: { category: "payment", value: "Sirojiddin Narkabilov" },
  card_number: { category: "payment", value: "8600 0000 0000 0000" },
  maintenance_mode: { category: "bot", value: false },
};

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = (error.message || "").toLowerCase();
  return (
    code === "PGRST204" ||
    code === "42P01" ||
    msg.includes("system_settings") ||
    msg.includes("audit_logs") ||
    msg.includes("could not find table") ||
    msg.includes("schema cache")
  );
}

export async function getSystemSettings(category?: string): Promise<Record<string, any>> {
  try {
    const supabase = getSupabase();
    let query = supabase.from("system_settings").select("*");

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      if (isMissingTableError(error)) {
        console.warn("system_settings table missing or inaccessible, returning fallback cache:", error.message);
      } else {
        console.error("getSystemSettings query error:", error);
      }
      return { ...inMemoryCache };
    }

    const settings: Record<string, any> = { ...inMemoryCache };
    (data || []).forEach((row) => {
      settings[row.key] = row.value;
      inMemoryCache[row.key] = row.value;
    });

    return settings;
  } catch (err) {
    console.error("getSystemSettings exception:", err);
    return { ...inMemoryCache };
  }
}

export async function getSettingByKey<T>(key: string, defaultValue?: T): Promise<T> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", key)
      .single();

    if (error || !data) {
      if (inMemoryCache[key] !== undefined) {
        return inMemoryCache[key] as T;
      }
      const fallback = DEFAULT_SETTINGS[key]?.value;
      return (fallback !== undefined ? fallback : defaultValue) as T;
    }

    inMemoryCache[key] = data.value;
    return data.value as T;
  } catch (err) {
    if (inMemoryCache[key] !== undefined) {
      return inMemoryCache[key] as T;
    }
    const fallback = DEFAULT_SETTINGS[key]?.value;
    return (fallback !== undefined ? fallback : defaultValue) as T;
  }
}

export async function updateSystemSetting(
  key: string,
  value: any,
  category: string,
  adminId: number
): Promise<void> {
  const oldValue = await getSettingByKey(key);
  inMemoryCache[key] = value;

  try {
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
      if (isMissingTableError(error)) {
        console.warn("system_settings table missing during upsert, stored in-memory:", error.message);
      } else {
        console.error("updateSystemSetting error:", error);
      }
    }
  } catch (err) {
    console.error("updateSystemSetting exception:", err);
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
  const oldMap = await getSystemSettings();
  settings.forEach((s) => {
    inMemoryCache[s.key] = s.value;
  });

  try {
    const supabase = getSupabase();
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
    }
  } catch (err) {
    console.error("updateSettingsBatch exception:", err);
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
