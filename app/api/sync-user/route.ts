import { NextResponse } from "next/server";
import { saveOrUpdateUser } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, first_name, username } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing telegram id" }, { status: 400 });
    }

    const user = await saveOrUpdateUser(
      Number(id),
      first_name || "Telegram User",
      username || undefined
    );

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error("Sync user error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
