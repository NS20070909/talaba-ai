import { NextResponse } from "next/server";
import { restoreDefaultSetting } from "@/lib/settings";
import { isOwner } from "@/lib/admin-management";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { key, admin_id } = body;

    if (!admin_id || !isOwner(Number(admin_id))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
    }

    if (!key) {
      return NextResponse.json({ success: false, error: "key is required" }, { status: 400 });
    }

    const restoredValue = await restoreDefaultSetting(key, Number(admin_id));
    return NextResponse.json({ success: true, message: `Setting '${key}' restored to default`, value: restoredValue });
  } catch (error: any) {
    console.error("Restore setting API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
