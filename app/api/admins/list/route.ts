import { NextResponse } from "next/server";
import { getAllAdminsV2, isOwner, isAdminActive } from "@/lib/admin-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const admin_id = Number(searchParams.get("admin_id"));

    if (!admin_id || !(await isAdminActive(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    const admins = await getAllAdminsV2();
    return NextResponse.json({ success: true, count: admins.length, admins });
  } catch (error: any) {
    console.error("Get admins list API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
