import { NextResponse } from "next/server";
import { retryFailedBroadcast } from "@/lib/broadcast";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { broadcast_id, sender_id } = body;

    if (!sender_id || !(await isAdmin(Number(sender_id)))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (!broadcast_id) {
      return NextResponse.json({ success: false, error: "broadcast_id is required" }, { status: 400 });
    }

    const retried = await retryFailedBroadcast(broadcast_id);
    return NextResponse.json({ success: true, broadcast: retried });
  } catch (error: any) {
    console.error("Retry broadcast error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
