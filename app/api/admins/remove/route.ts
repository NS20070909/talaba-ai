import { NextResponse } from "next/server";
import { removeAdminV2, isOwner } from "@/lib/admin-management";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { target_telegram_id, admin_id } = body;

    if (!admin_id || !isOwner(Number(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
    }

    if (!target_telegram_id) {
      return NextResponse.json({ success: false, error: "target_telegram_id is required" }, { status: 400 });
    }

    await removeAdminV2(Number(target_telegram_id), Number(admin_id));
    return NextResponse.json({ success: true, message: "Admin removed successfully" });
  } catch (error: any) {
    console.error("Remove admin API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
