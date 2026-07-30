import { NextResponse } from "next/server";
import { exportPaymentsCSV } from "@/lib/payment";

export async function GET(req: Request) {
  try {
    const csvData = await exportPaymentsCSV();
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payments_export_${Date.now()}.csv"`,
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/payments/export:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
