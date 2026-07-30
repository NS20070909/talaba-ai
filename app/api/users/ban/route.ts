import { NextResponse } from "next/server";
import { banUserV2, unbanUserV2 } from "@/lib/user-management";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegram_id, admin_id, action, reason } = body;

    if (!admin_id || !(await isAdmin(Number(admin_id)))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (!telegram_id || !action) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    if (action === "BAN") {
      if (!reason || reason.trim().length === 0) {
        return NextResponse.json({ success: false, error: "Reason is required to ban user" }, { status: 400 });
      }
      await banUserV2(Number(telegram_id), reason);
    } else if (action === "UNBAN") {
      await unbanUserV2(Number(telegram_id));
    }

    return NextResponse.json({ success: true, message: `User ${action} completed.` });
  } catch (error: any) {
    console.error("User ban API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
