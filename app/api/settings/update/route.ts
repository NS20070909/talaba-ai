import { NextResponse } from "next/server";
import { updateSettingsBatch, updateSystemSetting } from "@/lib/settings";
import { isOwner, hasSettingCategoryPermission } from "@/lib/admin-management";
import { recordAuditLog } from "@/lib/audit-log";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { settings, admin_id, key, value, category } = body;

    const adminIdNum = Number(admin_id);
    if (!adminIdNum) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (category && !(await hasSettingCategoryPermission(adminIdNum, category))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_NO_CATEGORY_PERMISSION" }, { status: 403 });
    }

    if (Array.isArray(settings)) {
      await updateSettingsBatch(settings, Number(admin_id));
      await recordAuditLog({
        adminId: Number(admin_id),
        action: "SETTINGS_UPDATED",
        target: "SYSTEM",
        description: `Updated ${settings.length} system setting(s)`,
        metadata: { settings_updated: settings.map((s) => s.key) },
      });
    } else if (key && value !== undefined && category) {
      await updateSystemSetting(key, value, category, Number(admin_id));
      await recordAuditLog({
        adminId: Number(admin_id),
        action: "SETTINGS_UPDATED",
        target: key,
        description: `Updated setting '${key}' in category '${category}'`,
        metadata: { key, value, category },
      });
    } else {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Settings updated successfully" });
  } catch (error: any) {
    console.error("Update settings API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
