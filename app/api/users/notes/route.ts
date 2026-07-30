import { NextResponse } from "next/server";
import { addUserNote, getUserNotes, deleteUserNote } from "@/lib/user-management";
import { isAdmin, isOwner } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegram_id = Number(searchParams.get("telegram_id"));

    if (!telegram_id) {
      return NextResponse.json({ success: false, error: "telegram_id is required" }, { status: 400 });
    }

    const notes = await getUserNotes(telegram_id);
    return NextResponse.json({ success: true, notes });
  } catch (error: any) {
    console.error("Get user notes API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { telegram_id, admin_id, note_text } = body;

    if (!admin_id || !(await isAdmin(Number(admin_id)))) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    if (!telegram_id || !note_text) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const note = await addUserNote(Number(telegram_id), Number(admin_id), note_text);
    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    console.error("Add user note API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const note_id = searchParams.get("note_id");
    const admin_id = Number(searchParams.get("admin_id"));

    if (!admin_id || !isOwner(admin_id)) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED_OWNER_ONLY" }, { status: 403 });
    }

    if (!note_id) {
      return NextResponse.json({ success: false, error: "note_id is required" }, { status: 400 });
    }

    await deleteUserNote(note_id, admin_id);
    return NextResponse.json({ success: true, message: "Note deleted." });
  } catch (error: any) {
    console.error("Delete user note API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
