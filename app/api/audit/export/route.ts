import { NextResponse } from "next/server";
import { exportAuditLogsCSV } from "@/lib/audit-log";
import { isOwner } from "@/lib/admin-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const admin_id = Number(searchParams.get("admin_id"));

    if (!admin_id || !isOwner(admin_id)) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
    }

    const csv = await exportAuditLogsCSV();
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit_logs_${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Export audit logs API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
