import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getUserPayments } from "@/lib/payment";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramIdParam = searchParams.get("telegram_id");

    if (!telegramIdParam) {
      return NextResponse.json(
        { success: false, error: "MISSING_TELEGRAM_ID", message: "telegram_id parameter is required." },
        { status: 400 }
      );
    }

    const telegramId = Number(telegramIdParam);
    if (isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "INVALID_TELEGRAM_ID", message: "telegram_id must be a valid number." },
        { status: 400 }
      );
    }

    const payments = await getUserPayments(telegramId);
    
    // Generate signed URLs for proof images if they exist
    const supabase = getSupabase();
    const paymentsWithSignedUrls = await Promise.all(
      payments.map(async (payment) => {
        if (payment.proof_url) {
          try {
            const { data, error } = await supabase.storage
              .from("payment-proofs")
              .createSignedUrl(payment.proof_url, 3600); // Valid for 1 hour

            if (!error && data) {
              return {
                ...payment,
                signed_proof_url: data.signedUrl,
              };
            }
          } catch (storageErr) {
            console.error(`Failed to generate signed url for payment ${payment.id}:`, storageErr);
          }
        }
        return payment;
      })
    );

    return NextResponse.json({
      success: true,
      payments: paymentsWithSignedUrls,
    });
  } catch (error: any) {
    console.error("Error in GET /api/payments/history:", error);
    return NextResponse.json(
      { success: false, error: "SERVER_ERROR", message: "Internal server error." },
      { status: 500 }
    );
  }
}
