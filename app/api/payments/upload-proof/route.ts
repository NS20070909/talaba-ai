import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getPaymentById, setPaymentProofUrl, createPaymentWithProof } from "@/lib/payment";
import { bot } from "@/lib/bot";
import { getUser } from "@/lib/storage";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const paymentId = formData.get("payment_id") as string | null;
    const telegramIdRaw = formData.get("telegram_id") as string | null;
    const plan = formData.get("plan") as string | null;
    const amountRaw = formData.get("amount") as string | null;
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ success: false, error: "Chek rasmi tanlanmagan" }, { status: 400 });
    }

    // Validate file type — only images allowed
    const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
    const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
    const fileExt = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.type) || !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { success: false, error: "Faqat rasm fayllarini yuklash mumkin (JPEG, PNG, WEBP)" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const randomStr = Math.floor(Math.random() * 1000000);

    let paymentRecord: any = null;
    let filePath = "";

    if (paymentId) {
      // Flow with existing paymentId
      paymentRecord = await getPaymentById(paymentId);
      if (!paymentRecord) {
        return NextResponse.json({ success: false, error: "Payment topilmadi" }, { status: 404 });
      }
      if (paymentRecord.status !== "PENDING" && paymentRecord.status !== "pending") {
        return NextResponse.json({ success: false, error: "To'lov allaqachon ko'rib chiqilgan" }, { status: 400 });
      }

      filePath = `${paymentId}_${Date.now()}_${randomStr}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json({ success: false, error: "Chekni saqlashda xatolik yuz berdi" }, { status: 500 });
      }

      const updated = await setPaymentProofUrl(paymentId, filePath);
      if (!updated) {
        try { await supabase.storage.from("payment-proofs").remove([filePath]); } catch {}
        return NextResponse.json({ success: false, error: "Chek allaqachon yuklangan" }, { status: 400 });
      }
    } else if (telegramIdRaw && plan && amountRaw) {
      // Flow: Single-step creation with proof (Payment record created ONLY AFTER proof upload succeeds)
      const telegramId = Number(telegramIdRaw);
      const amount = Number(amountRaw);

      if (isNaN(telegramId) || isNaN(amount)) {
        return NextResponse.json({ success: false, error: "Noto'g'ri parametrlari" }, { status: 400 });
      }

      const tempId = `tmp_${Date.now()}_${randomStr}`;
      filePath = `${tempId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, file);

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        return NextResponse.json({ success: false, error: "Chekni saqlashda xatolik yuz berdi" }, { status: 500 });
      }

      try {
        paymentRecord = await createPaymentWithProof({
          telegram_id: telegramId,
          amount: amount,
          provider: "manual",
          plan: plan,
          proof_url: filePath,
        });
      } catch (createErr) {
        try { await supabase.storage.from("payment-proofs").remove([filePath]); } catch {}
        throw createErr;
      }
    } else {
      return NextResponse.json({ success: false, error: "Kam parametrlari yuborildi" }, { status: 400 });
    }

    // Fetch user info for instant notification
    const user = await getUser(paymentRecord.telegram_id);
    const firstName = user?.firstName || "Unknown";
    const username = user?.username ? `@${user.username}` : "yo'q";

    const ownerMsg = `🆕 Yangi Payment (Chek yuklandi)\n\n` +
      `👤 Ism: ${firstName}\n` +
      `📛 Username: ${username}\n` +
      `🆔 Telegram ID: <code>${paymentRecord.telegram_id}</code>\n\n` +
      `📦 Tarif: <b>${paymentRecord.plan}</b>\n` +
      `💵 Summa: ${paymentRecord.amount?.toLocaleString("uz-UZ")} UZS\n` +
      `📅 Vaqt: ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n\n` +
      `Status: ⏳ PROOF_UPLOADED`;

    const inlineKeyboard = {
      inline_keyboard: [
        [{ text: "📸 View Proof", callback_data: `admin:pay:view:${paymentRecord.id}` }],
        [
          { text: "✅ Confirm", callback_data: `admin:pay:confirm:${paymentRecord.id}` },
          { text: "❌ Reject", callback_data: `admin:pay:reject:${paymentRecord.id}` }
        ]
      ]
    };

    try {
      await bot.telegram.sendMessage(6630030492, ownerMsg, { parse_mode: "HTML", reply_markup: inlineKeyboard });
    } catch (botErr) {
      console.error("Owner payment notification failed:", botErr);
    }

    return NextResponse.json({ success: true, payment: paymentRecord, proof_url: filePath });
  } catch (error) {
    console.error("Upload proof error:", error);
    return NextResponse.json({ success: false, error: "Serverda xatolik yuz berdi" }, { status: 500 });
  }
}

