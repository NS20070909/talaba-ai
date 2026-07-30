import { NextResponse } from "next/server";
import { managePremiumV2 } from "@/lib/user-management";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegram_id, admin_id, action, plan, days } = body;

    if (!admin_id || !(await isAdmin(Number(admin_id)))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (!telegram_id || !action) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    await managePremiumV2({
      telegramId: Number(telegram_id),
      adminId: Number(admin_id),
      action,
      plan: plan || "STUDENT",
      days: days ? Number(days) : undefined,
    });

    return NextResponse.json({ success: true, message: `Premium action ${action} completed.` });
  } catch (error: any) {
    console.error("User premium API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
