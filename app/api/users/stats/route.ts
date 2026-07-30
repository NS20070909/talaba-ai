import { NextResponse } from "next/server";
import { getUserStatsV2 } from "@/lib/user-management";

export async function GET(req: Request) {
  try {
    const stats = await getUserStatsV2();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error("User stats API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
