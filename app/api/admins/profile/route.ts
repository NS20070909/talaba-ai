import { NextResponse } from "next/server";
import { getAdminProfile, isAdminActive } from "@/lib/admin-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const target_id = Number(searchParams.get("target_id") || searchParams.get("telegram_id"));
    const admin_id = Number(searchParams.get("admin_id"));

    if (!admin_id || !(await isAdminActive(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    const profile = await getAdminProfile(target_id || admin_id);
    if (!profile) {
      return NextResponse.json({ success: false, error: "Admin not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("Get admin profile API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
