import { NextResponse } from "next/server";
import { getAuditLogs } from "@/lib/audit-log";
import { hasPermission } from "@/lib/admin-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const admin_id = Number(searchParams.get("admin_id"));
    const action = searchParams.get("action") || undefined;
    const filterAdminId = searchParams.get("filter_admin_id") ? Number(searchParams.get("filter_admin_id")) : undefined;
    const search = searchParams.get("search") || undefined;
    const limit = Number(searchParams.get("limit")) || 50;
    const offset = Number(searchParams.get("offset")) || 0;

    if (!admin_id || !(await hasPermission(admin_id, "audit_log"))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_NO_PERMISSION" }, { status: 403 });
    }

    const { logs, total } = await getAuditLogs({
      action,
      adminId: filterAdminId,
      search,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, count: logs.length, total, logs });
  } catch (error: any) {
    console.error("Get audit logs API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
