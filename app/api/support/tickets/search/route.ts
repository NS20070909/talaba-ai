import { NextResponse } from "next/server";
import { searchTickets } from "@/lib/support";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || searchParams.get("q");

    if (!query) {
      return NextResponse.json({ success: false, error: "query parameter required" }, { status: 400 });
    }

    const tickets = await searchTickets(query);
    return NextResponse.json({ success: true, count: tickets.length, tickets });
  } catch (error: any) {
    console.error("Support search API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
