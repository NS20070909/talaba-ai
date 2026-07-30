import { NextResponse } from "next/server";
import { getSupportStats } from "@/lib/support";

export async function GET(req: Request) {
  try {
    const stats = await getSupportStats();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("Support stats API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
