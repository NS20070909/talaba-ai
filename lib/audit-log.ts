import { getSupabase } from "./supabase";

export interface AuditLogRecord {
  id: string;
  admin_id: number;
  admin_name: string | null;
  action: string;
  target: string | null;
  description: string;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  metadata: any;
  created_at: string;
}

const inMemoryLogs: AuditLogRecord[] = [];

export async function recordAuditLog(data: {
  adminId: number;
  adminName?: string;
  action: string;
  target?: string;
  description: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  metadata?: any;
}): Promise<AuditLogRecord | null> {
  const localRecord: AuditLogRecord = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    admin_id: data.adminId,
    admin_name: data.adminName || `Admin ${data.adminId}`,
    action: data.action,
    target: data.target || null,
    description: data.description,
    old_value: data.oldValue !== undefined ? data.oldValue : null,
    new_value: data.newValue !== undefined ? data.newValue : null,
    ip_address: data.ipAddress || null,
    metadata: data.metadata || {},
    created_at: new Date().toISOString(),
  };

  inMemoryLogs.unshift(localRecord);
  if (inMemoryLogs.length > 500) inMemoryLogs.pop();

  try {
    const supabase = getSupabase();
    const { data: record, error } = await supabase
      .from("audit_logs")
      .insert({
        admin_id: data.adminId,
        admin_name: data.adminName || `Admin ${data.adminId}`,
        action: data.action,
        target: data.target || null,
        description: data.description,
        old_value: data.oldValue !== undefined ? data.oldValue : null,
        new_value: data.newValue !== undefined ? data.newValue : null,
        ip_address: data.ipAddress || null,
        metadata: data.metadata || {},
      })
      .select("*")
      .single();

    if (error) {
      console.warn("recordAuditLog warning (table missing or error):", error.message);
      return localRecord;
    }

    return record as AuditLogRecord;
  } catch (err: any) {
    console.warn("recordAuditLog exception caught cleanly:", err?.message || err);
    return localRecord;
  }
}

export async function getAuditLogs(options?: {
  action?: string;
  adminId?: number;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLogRecord[]; total: number }> {
  try {
    const supabase = getSupabase();
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    let query = supabase.from("audit_logs").select("*", { count: "exact" });

    if (options?.action) {
      query = query.eq("action", options.action);
    }

    if (options?.adminId) {
      query = query.eq("admin_id", options.adminId);
    }

    if (options?.startDate) {
      query = query.gte("created_at", options.startDate);
    }

    if (options?.endDate) {
      query = query.lte("created_at", options.endDate);
    }

    if (options?.search) {
      const clean = options.search.trim();
      query = query.or(`description.ilike.%${clean}%,target.ilike.%${clean}%,action.ilike.%${clean}%`);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error || !data) {
      return { logs: inMemoryLogs.slice(offset, offset + limit), total: inMemoryLogs.length };
    }

    return {
      logs: data as AuditLogRecord[],
      total: count || data.length,
    };
  } catch (err) {
    return { logs: inMemoryLogs.slice(0, 50), total: inMemoryLogs.length };
  }
}

export async function exportAuditLogsCSV(): Promise<string> {
  const { logs } = await getAuditLogs({ limit: 1000 });

  let csv = "ID,Admin ID,Admin Name,Action,Target,Description,Old Value,New Value,IP Address,Created At\n";
  logs.forEach((l) => {
    const oldStr = JSON.stringify(l.old_value || "").replace(/"/g, '""');
    const newStr = JSON.stringify(l.new_value || "").replace(/"/g, '""');
    const descStr = (l.description || "").replace(/"/g, '""');
    csv += `"${l.id}","${l.admin_id}","${l.admin_name || ""}","${l.action}","${l.target || ""}","${descStr}","${oldStr}","${newStr}","${l.ip_address || ""}","${l.created_at}"\n`;
  });
  return csv;
}
