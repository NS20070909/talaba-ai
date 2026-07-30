import { NextResponse } from "next/server";
import { processScheduledBroadcasts } from "@/lib/broadcast";

export async function GET(req: Request) {
  try {
    const executedCount = await processScheduledBroadcasts();
    return NextResponse.json({
      success: true,
      executedCount,
    });
  } catch (error: any) {
    console.error("Broadcast scheduler cron error:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
