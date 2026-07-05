import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPaymentById, setPaymentProofUrl } from "@/lib/payment";
import { bot } from "@/lib/bot";
import { getUser } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const paymentId = formData.get("payment_id") as string;
    const file = formData.get("image") as File;

    if (!paymentId || !file) {
      return NextResponse.json({ success: false, error: "Missing parameters" }, { status: 400 });
    }

    const payment = await getPaymentById(paymentId);
    if (!payment) {
      return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
    }

    if (payment.status !== "pending") {
      return NextResponse.json({ success: false, error: "Payment is already processed" }, { status: 400 });
    }

    if (payment.proof_url) {
      return NextResponse.json({ success: false, error: "Proof already uploaded" }, { status: 400 });
    }

    // Upload to Supabase Storage
    const supabase = getSupabase();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const randomStr = Math.floor(Math.random() * 1000000);
    const fileName = `${paymentId}_${Date.now()}_${randomStr}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(filePath, file);

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
    }

    // Store only the path or object ID, because it's a private bucket.
    const updated = await setPaymentProofUrl(paymentId, filePath);
    if (!updated) {
      // Clean up the uploaded file from storage
      try {
        await supabase.storage.from("payment-proofs").remove([filePath]);
      } catch (err) {
        console.error("Failed to remove uploaded proof on collision:", err);
      }
      return NextResponse.json({ success: false, error: "Proof already uploaded" }, { status: 400 });
    }

    // Fetch user info for notification
    const user = await getUser(payment.telegram_id);
    const firstName = user?.firstName || "Unknown";
    const username = user?.username ? `@${user.username}` : "yo'q";

    const ownerMsg = `🆕 Yangi Payment (Chek yuklandi)\n\n` +
      `👤 Ism: ${firstName}\n` +
      `📛 Username: ${username}\n` +
      `🆔 Telegram ID: ${payment.telegram_id}\n\n` +
      `📦 Tarif: ${payment.plan}\n` +
      `💵 Summa: ${payment.amount}\n` +
      `📅 Yaratilgan: ${new Date(payment.created_at).toLocaleString("uz-UZ", {timeZone: "Asia/Tashkent"})}\n\n` +
      `Status: ⏳ Pending`;

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: "📸 View Proof", callback_data: `admin:pay:view:${payment.id}` }],
        [
          { text: "✅ Confirm", callback_data: `admin:pay:confirm:${payment.id}` },
          { text: "❌ Reject", callback_data: `admin:pay:reject:${payment.id}` }
        ]
      ]
    };

    await bot.telegram.sendMessage(6630030492, ownerMsg, { reply_markup: inlineKeyboard });

    return NextResponse.json({ success: true, proof_url: filePath });
  } catch (error) {
    console.error("Upload proof error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
