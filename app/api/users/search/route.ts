import { NextResponse } from "next/server";
import { searchUsersV2 } from "@/lib/user-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || searchParams.get("q");

    if (!query) {
      return NextResponse.json({ success: false, error: "query parameter required" }, { status: 400 });
    }

    const users = await searchUsersV2(query);
    return NextResponse.json({ success: true, count: users.length, users });
  } catch (error: any) {
    console.error("User search API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
