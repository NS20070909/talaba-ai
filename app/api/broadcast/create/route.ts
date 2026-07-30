import { NextResponse } from "next/server";
import { createBroadcastRecord, executeBroadcast, BroadcastTarget } from "@/lib/broadcast";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sender_id, target_type, message_text, scheduled_at, execute_now } = body;

    if (!sender_id || !(await isAdmin(Number(sender_id)))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (!target_type || !message_text) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const broadcast = await createBroadcastRecord({
      sender_id: Number(sender_id),
      target_type: target_type as BroadcastTarget,
      message_text: message_text,
      scheduled_at: scheduled_at || null,
    });

    if (execute_now && !scheduled_at) {
      const executed = await executeBroadcast(broadcast.id);
      return NextResponse.json({ success: true, broadcast: executed });
    }

    return NextResponse.json({ success: true, broadcast });
  } catch (error: any) {
    console.error("Create broadcast error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
