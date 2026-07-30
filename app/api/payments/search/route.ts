import { NextResponse } from "next/server";
import { searchPayments } from "@/lib/payment";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || searchParams.get("q");

    if (!query) {
      return NextResponse.json(
        { success: false, error: "MISSING_QUERY", message: "query parameter is required." },
        { status: 400 }
      );
    }

    const results = await searchPayments(query);
    return NextResponse.json({
      success: true,
      query: query,
      count: results.length,
      payments: results,
    });
  } catch (error: any) {
    console.error("Error in GET /api/payments/search:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
