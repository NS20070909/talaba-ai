import { NextResponse } from "next/server";
import { getBroadcastHistory } from "@/lib/broadcast";

export async function GET(req: Request) {
  try {
    const history = await getBroadcastHistory(50);
    return NextResponse.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error: any) {
    console.error("Broadcast history API error:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
