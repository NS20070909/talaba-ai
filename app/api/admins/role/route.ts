import { NextResponse } from "next/server";
import { updateAdminRole, isOwner, AdminRole, AdminPermission } from "@/lib/admin-management";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { target_telegram_id, role, permissions, admin_id } = body;

    if (!admin_id || !isOwner(Number(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
    }

    if (!target_telegram_id || !role || !permissions) {
      return NextResponse.json({ success: false, error: "target_telegram_id, role, and permissions are required" }, { status: 400 });
    }

    await updateAdminRole(
      Number(target_telegram_id),
      role as AdminRole,
      permissions as AdminPermission[],
      Number(admin_id)
    );
    return NextResponse.json({ success: true, message: "Admin role and permissions updated successfully" });
  } catch (error: any) {
    console.error("Update admin role API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
