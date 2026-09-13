import { NextResponse } from "next/server";
import { getSystemSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSystemSettings("payment");
    return NextResponse.json(
      {
        success: true,
        settings: {
          card_holder: settings.card_holder || "SUXROB NARKABILOV",
          card_number: settings.card_number || "9860350144459038",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Get payment settings API error:", error);
    return NextResponse.json(
      {
        success: true,
        settings: {
          card_holder: "SUXROB NARKABILOV",
          card_number: "9860350144459038",
        },
      },
      { status: 200 }
    );
  }
}
