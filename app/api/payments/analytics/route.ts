import { NextResponse } from "next/server";
import { getPaymentAnalytics } from "@/lib/payment";

export async function GET(req: Request) {
  try {
    const analytics = await getPaymentAnalytics();
    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    console.error("Error in GET /api/payments/analytics:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
