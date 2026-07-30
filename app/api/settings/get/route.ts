import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";
import { isAdminActive, hasSettingCategoryPermission } from "@/lib/admin-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const admin_id = Number(searchParams.get("admin_id"));

    if (!admin_id || !(await isAdminActive(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (category && !(await hasSettingCategoryPermission(admin_id, category))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_NO_CATEGORY_PERMISSION" }, { status: 403 });
    }

    const settings = await getSystemSettings(category);
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error("Get settings API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
