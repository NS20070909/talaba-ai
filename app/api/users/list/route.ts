import { NextResponse } from "next/server";
import { getFilteredUsers } from "@/lib/user-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "ALL";
    const limit = Number(searchParams.get("limit") || 30);
    const offset = Number(searchParams.get("offset") || 0);

    const result = await getFilteredUsers(filter, limit, offset);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("User list API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
