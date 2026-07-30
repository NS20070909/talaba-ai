import { NextResponse } from "next/server";
import { getFullUserProfile, getUserNotes, getPremiumHistory } from "@/lib/user-management";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id") || searchParams.get("telegram_id"));

    if (!id || isNaN(id)) {
      return NextResponse.json({ success: false, error: "Valid telegram_id is required" }, { status: 400 });
    }

    const profile = await getFullUserProfile(id);
    if (!profile) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    const [notes, premiumHistory] = await Promise.all([
      getUserNotes(id),
      getPremiumHistory(id),
    ]);

    return NextResponse.json({ success: true, profile, notes, premiumHistory });
  } catch (error: any) {
    console.error("User profile API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
