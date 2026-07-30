import { getSupabase } from "./supabase";
import { recordAuditLog } from "./audit-log";

export const OWNER_ID = 6630030492;

export type AdminRole = "OWNER" | "ADMIN" | "MODERATOR";
export type AdminStatus = "ACTIVE" | "DISABLED" | "REMOVED";
export type AdminPermission = "payment" | "broadcast" | "support" | "users" | "settings" | "audit_log";

export interface AdminProfile {
  id: string;
  telegram_id: number;
  name: string | null;
  username: string | null;
  role: AdminRole;
  status: AdminStatus;
  is_deleted: boolean;
  permissions: AdminPermission[];
  last_login: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
}

export function isOwner(telegramId: number): boolean {
  return telegramId === OWNER_ID;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTICATION & PERMISSIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getAdminProfile(telegramId: number): Promise<AdminProfile | null> {
  if (isOwner(telegramId)) {
    return {
      id: "owner-uuid",
      telegram_id: OWNER_ID,
      name: "Owner",
      username: "Narkabilov_S_07",
      role: "OWNER",
      status: "ACTIVE",
      is_deleted: false,
      permissions: ["payment", "broadcast", "support", "users", "settings", "audit_log"],
      last_login: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    telegram_id: Number(data.telegram_id),
    name: data.name || null,
    username: data.username || null,
    role: (data.role as AdminRole) || "ADMIN",
    status: (data.status as AdminStatus) || "ACTIVE",
    is_deleted: !!data.is_deleted,
    permissions: Array.isArray(data.permissions) ? data.permissions : ["payment", "broadcast", "support", "users", "settings", "audit_log"],
    last_login: data.last_login || null,
    last_seen: data.last_seen || data.last_login || null,
    created_at: data.created_at,
    updated_at: data.updated_at || data.created_at,
  };
}

export async function isAdminActive(telegramId: number): Promise<boolean> {
  if (isOwner(telegramId)) return true;

  const profile = await getAdminProfile(telegramId);
  if (!profile || profile.is_deleted) return false;
  return profile.status === "ACTIVE";
}

export async function hasPermission(
  telegramId: number,
  permission: AdminPermission
): Promise<boolean> {
  if (isOwner(telegramId)) return true;

  const profile = await getAdminProfile(telegramId);
  if (!profile || profile.is_deleted || profile.status !== "ACTIVE") return false;
  return profile.permissions.includes(permission);
}

export async function hasSettingCategoryPermission(
  telegramId: number,
  category: string
): Promise<boolean> {
  if (isOwner(telegramId)) return true;

  const profile = await getAdminProfile(telegramId);
  if (!profile || profile.is_deleted || profile.status !== "ACTIVE") return false;

  const perms = profile.permissions as string[];
  if (perms.includes("settings")) return true;
  if (perms.includes(`settings:${category}`)) return true;
  if (category === "payment" && perms.includes("payment")) return true;
  if (category === "support" && perms.includes("support")) return true;
  if (category === "broadcast" && perms.includes("broadcast")) return true;
  if (category === "users" && perms.includes("users")) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN MANAGEMENT (Soft deletion & audit logging)
// ─────────────────────────────────────────────────────────────────────────────

export async function addAdminV2(data: {
  telegramId: number;
  name?: string;
  username?: string;
  role?: AdminRole;
  permissions?: AdminPermission[];
  adminId: number;
}): Promise<AdminProfile> {
  if (!isOwner(data.adminId)) {
    throw new Error("UNAUTHORIZED_OWNER_ONLY: Only Owner can add admins.");
  }

  const supabase = getSupabase();
  const defaultPermissions: AdminPermission[] =
    data.permissions || ["payment", "broadcast", "support", "users", "settings", "audit_log"];

  const oldProfile = await getAdminProfile(data.telegramId);

  const { data: record, error } = await supabase
    .from("admins")
    .upsert(
      {
        telegram_id: data.telegramId,
        name: data.name || null,
        username: data.username || null,
        role: data.role || "ADMIN",
        status: "ACTIVE",
        is_deleted: false,
        permissions: defaultPermissions,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("addAdminV2 error:", error);
    throw error;
  }

  const newProfile = {
    ...record,
    telegram_id: Number(record.telegram_id),
    permissions: record.permissions || defaultPermissions,
  };

  await recordAuditLog({
    adminId: data.adminId,
    action: "ADMIN_ADDED",
    target: `user:${data.telegramId}`,
    description: `Added admin ${data.telegramId} with role ${data.role || "ADMIN"}`,
    oldValue: oldProfile,
    newValue: newProfile,
  });

  return newProfile;
}

export async function removeAdminV2(targetTelegramId: number, adminId: number): Promise<void> {
  if (!isOwner(adminId)) {
    throw new Error("UNAUTHORIZED_OWNER_ONLY: Only Owner can remove admins.");
  }
  if (isOwner(targetTelegramId)) {
    throw new Error("CANNOT_REMOVE_OWNER: Owner cannot be removed.");
  }

  const oldProfile = await getAdminProfile(targetTelegramId);

  // Soft delete: update status to REMOVED and is_deleted to true
  const supabase = getSupabase();
  const { error } = await supabase
    .from("admins")
    .update({ status: "REMOVED", is_deleted: true, updated_at: new Date().toISOString() })
    .eq("telegram_id", targetTelegramId);

  if (error) {
    console.error("removeAdminV2 error:", error);
    throw error;
  }

  await recordAuditLog({
    adminId,
    action: "ADMIN_REMOVED",
    target: `user:${targetTelegramId}`,
    description: `Soft-removed admin ${targetTelegramId} (status set to REMOVED)`,
    oldValue: oldProfile,
    newValue: { status: "REMOVED", is_deleted: true },
  });
}

export async function updateAdminStatus(
  targetTelegramId: number,
  status: AdminStatus,
  adminId: number
): Promise<void> {
  if (!isOwner(adminId)) {
    throw new Error("UNAUTHORIZED_OWNER_ONLY: Only Owner can change admin status.");
  }
  if (isOwner(targetTelegramId)) {
    throw new Error("CANNOT_MODIFY_OWNER: Owner status cannot be modified.");
  }

  const oldProfile = await getAdminProfile(targetTelegramId);
  const isDeleted = status === "REMOVED";

  const supabase = getSupabase();
  const { error } = await supabase
    .from("admins")
    .update({ status, is_deleted: isDeleted, updated_at: new Date().toISOString() })
    .eq("telegram_id", targetTelegramId);

  if (error) {
    console.error("updateAdminStatus error:", error);
    throw error;
  }

  await recordAuditLog({
    adminId,
    action: status === "DISABLED" ? "ADMIN_DISABLED" : status === "ACTIVE" ? "ADMIN_ENABLED" : "ADMIN_STATUS_CHANGED",
    target: `user:${targetTelegramId}`,
    description: `Updated status for admin ${targetTelegramId} to ${status}`,
    oldValue: { status: oldProfile?.status, is_deleted: oldProfile?.is_deleted },
    newValue: { status, is_deleted: isDeleted },
  });
}

export async function updateAdminRole(
  targetTelegramId: number,
  role: AdminRole,
  permissions: AdminPermission[],
  adminId: number
): Promise<void> {
  if (!isOwner(adminId)) {
    throw new Error("UNAUTHORIZED_OWNER_ONLY: Only Owner can change admin roles.");
  }
  if (isOwner(targetTelegramId)) {
    throw new Error("CANNOT_MODIFY_OWNER: Owner role cannot be modified.");
  }

  const oldProfile = await getAdminProfile(targetTelegramId);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("admins")
    .update({ role, permissions, updated_at: new Date().toISOString() })
    .eq("telegram_id", targetTelegramId);

  if (error) {
    console.error("updateAdminRole error:", error);
    throw error;
  }

  await recordAuditLog({
    adminId,
    action: "ADMIN_ROLE_CHANGED",
    target: `user:${targetTelegramId}`,
    description: `Updated role for admin ${targetTelegramId} to ${role}`,
    oldValue: { role: oldProfile?.role, permissions: oldProfile?.permissions },
    newValue: { role, permissions },
  });
}

export async function updateAdminLastActivity(telegramId: number, isLogin: boolean = false): Promise<void> {
  if (isOwner(telegramId)) return;
  const supabase = getSupabase();
  const updateData: any = { last_seen: new Date().toISOString() };
  if (isLogin) {
    updateData.last_login = new Date().toISOString();
  }
  await supabase
    .from("admins")
    .update(updateData)
    .eq("telegram_id", telegramId);
}

export async function getAllAdminsV2(includeDeleted: boolean = false): Promise<AdminProfile[]> {
  const supabase = getSupabase();
  let query = supabase.from("admins").select("*").order("created_at", { ascending: false });
  if (!includeDeleted) {
    query = query.neq("status", "REMOVED").neq("is_deleted", true);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const list: AdminProfile[] = data.map((r) => ({
    id: r.id,
    telegram_id: Number(r.telegram_id),
    name: r.name || null,
    username: r.username || null,
    role: (r.role as AdminRole) || "ADMIN",
    status: (r.status as AdminStatus) || "ACTIVE",
    is_deleted: !!r.is_deleted,
    permissions: Array.isArray(r.permissions) ? r.permissions : ["payment", "broadcast", "support", "users", "settings", "audit_log"],
    last_login: r.last_login || null,
    last_seen: r.last_seen || r.last_login || null,
    created_at: r.created_at,
    updated_at: r.updated_at || r.created_at,
  }));

  const hasOwner = list.some((a) => a.telegram_id === OWNER_ID);
  if (!hasOwner) {
    list.unshift({
      id: "owner-uuid",
      telegram_id: OWNER_ID,
      name: "Owner",
      username: "Narkabilov_S_07",
      role: "OWNER",
      status: "ACTIVE",
      is_deleted: false,
      permissions: ["payment", "broadcast", "support", "users", "settings", "audit_log"],
      last_login: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return list;
}
