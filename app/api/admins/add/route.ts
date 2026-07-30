import { NextResponse } from "next/server";
import { addAdminV2, isOwner, AdminRole, AdminPermission } from "@/lib/admin-management";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { target_telegram_id, name, username, role, permissions, admin_id } = body;

    if (!admin_id || !isOwner(Number(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
    }

    if (!target_telegram_id) {
      return NextResponse.json({ success: false, error: "target_telegram_id is required" }, { status: 400 });
    }

    const admin = await addAdminV2({
      telegramId: Number(target_telegram_id),
      name: name || undefined,
      username: username || undefined,
      role: (role as AdminRole) || "ADMIN",
      permissions: permissions as AdminPermission[],
      adminId: Number(admin_id),
    });

    return NextResponse.json({ success: true, admin });
  } catch (error: any) {
    console.error("Add admin API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
