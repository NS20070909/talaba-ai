import { NextResponse } from "next/server";
import { updateAdminStatus, isOwner, AdminStatus } from "@/lib/admin-management";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { target_telegram_id, status, admin_id } = body;

    if (!admin_id || !isOwner(Number(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
    }

    if (!target_telegram_id || !status) {
      return NextResponse.json({ success: false, error: "target_telegram_id and status are required" }, { status: 400 });
    }

    await updateAdminStatus(Number(target_telegram_id), status as AdminStatus, Number(admin_id));
    return NextResponse.json({ success: true, message: `Admin status updated to ${status}` });
  } catch (error: any) {
    console.error("Update admin status API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
