import { NextResponse } from "next/server";
import { canUseScan, incrementScan } from "@/lib/limit-checker";
import { getVerifiedTelegramUser } from "@/lib/telegram-auth";
import { runGeminiWithFallback } from "@/lib/ai-fallback-runner";

export const maxDuration = 45;

const PROMPT_TEMPLATE = `
Sen TALABA AI uchun PROFESSIONAL SHPARGALKA AI'san.

SENING VAZIFANG:

1. Rasm ichidagi BARCHA savollarni top.
2. Hech bir savolni tashlab ketma.
3. Jadval, sxema yoki diagramma bo‘lsa uni to‘liq o‘qi va tushuntir.
4. Fan nomini top.
5. Bilet raqamini top.
6. Savollar sonini aniqlab, HAMMASIGA javob ber.
7. Agar 5 ta savol bo‘lsa 5 tasiga ham javob yoz.
8. OCR xato qilgan bo‘lsa ma'nosini tushunib to‘g‘rila.
9. Agar harf yoki so‘z buzilgan bo‘lsa, fan terminologiyasidan kelib chiqib mantiqan tikla.
10. Imtihonda aytsa bo‘ladigan darajada tushuntir.
11. Talaba eng yuqori ball olishi uchun faqat kerakli ma'lumotlarni yoz.
12. Savol tushunarsiz bo‘lsa ham mantiqan tiklashga harakat qil va baribir javob ber.

JAVOB QOIDALARI:

- Juda uzun yozma.
- Har savolga 2–4 ta mazmunli gap yoz.
- Mazmunli yoz.
- Keraksiz gap yozma.
- Suv gaplar yozma.
- Muhim joylarini punkt bilan ber.
- Eng ko‘p tushadigan imtihon faktlarini yoz.
- Kod bo‘lsa faqat C++ yoz.
- Kod qisqa, minimal va ishlaydigan bo‘lsin.
- Formula kerak bo‘lsa albatta yoz.
- Ta'riflarni sodda, lekin professional yoz.
- Markdown ishlatma.
- ###, **, \`\`\`, __ ishlatma.
- Matn oddiy va toza ko‘rinishda bo‘lsin.
- FORMATNI BUZMA.
- HAR BIR SAVOL UCHUN FORMATNI TAKRORLA.

MUHIM:

- Agar rasm sifati past, xira yoki qisman yopilgan bo‘lsa ham maksimal aniqlik bilan savollarni tushunishga harakat qil.
- Savollarni taxmin qilish kerak bo‘lsa, fan kontekstidan foydalanib eng ehtimolli variantni tanla.
- "O‘qiy olmadim" yoki "aniq ko‘rinmayapti" degan javob yozma.
- Savol tashlab ketma.
- Rasmni diqqat bilan bir necha marta tahlil qil.
- Javoblar imtihonda aytishga qulay va eslab qolishga oson bo‘lsin.

FORMAT:

📚 Fan: (fan nomi)

🎫 Bilet: (raqam)

1-savol

📌 Ta'rif:
(2-4 gap)

🔥 Muhim joylari:
• fakt
• fakt
• fakt

💡 Eslab qolish:
(1 ta eng sodda eslab qolish usuli yoki qiyoslash)

Agar dasturlash savoli bo‘lsa:

🧠 Tushuntirish:
(qisqa tushuntir)

💻 C++ kodi:
(kod)

HAMMA SAVOLLARGA JAVOB BER.
SAVOL TASHLAB KETMA.
FORMATNI BUZMA.
RASMNI DIQQAT BILAN O‘QI.
`;

export async function POST(req: Request) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { result: "❌ Yaroqsiz so'rov ma'lumotlari (JSON parsing error)" },
        { status: 400 }
      );
    }

    const { image } = body;
    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { result: "❌ Rasm topilmadi yoki noto'g'ri format" },
        { status: 400 }
      );
    }

    // Authenticate user via HMAC initData or fallback
    const auth = await getVerifiedTelegramUser(req, body);
    if (!auth.authenticated || !auth.telegramId) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          result: "❌ Avtorizatsiya xatosi. Iltimos, Telegram orqali qayta kiring.",
        },
        { status: 401 }
      );
    }

    const telegramId = auth.telegramId;

    // Fast single-pass limit check
    const limitCheck = await canUseScan(telegramId);
    if (!limitCheck.allowed) {
      if (limitCheck.banned) {
        return NextResponse.json(
          {
            success: false,
            code: "BANNED",
            result: "🚫 Siz bloklangansiz",
          },
          { status: 403 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "LIMIT_REACHED",
          result: "⚠️ Sizning kunlik Scan limiti tugagan. Ertaga yangilanadi yoki Premium rejasiga o'ting.",
        },
        { status: 403 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { result: "❌ Server sozlanmagan: GEMINI_API_KEY topilmadi" },
        { status: 500 }
      );
    }

    // Sanitize image base64
    let cleanImageBase64 = image;
    let mimeType = "image/jpeg";
    if (image.startsWith("data:")) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        cleanImageBase64 = match[2];
      }
    }

    // Bounded fallback execution: 10s per model, max 32s total budget
    const { text: responseText } = await runGeminiWithFallback({
      apiKey,
      modelChain: [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash-lite",
      ],
      prompt: [
        PROMPT_TEMPLATE,
        {
          inlineData: {
            mimeType,
            data: cleanImageBase64,
          },
        },
      ],
      perModelTimeoutMs: 10000,
      maxRetriesPerModel: 1,
      maxTotalMs: 32000,
    });

    // Increment scan usage only after successful response
    await incrementScan(telegramId);

    return NextResponse.json({
      success: true,
      result: responseText,
    });
  } catch (error: any) {
    const errorMsg = error?.message || "";
    console.error("❌ /api/analyze error:", errorMsg);

    const isTimeout =
      errorMsg.includes("Timeout") ||
      errorMsg.includes("timeout") ||
      errorMsg.includes("abort") ||
      errorMsg.includes("Total timeout budget exceeded");

    if (isTimeout) {
      return NextResponse.json(
        {
          success: false,
          error: "TIMEOUT",
          result: "⏳ Tahlil qilish vaqti tugadi (server band). Iltimos, qayta urinib ko'ring yoki rasm hajmini kichikroq qiling.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "AI_ERROR",
        result: "❌ AI xizmati vaqtincha band. Bir necha soniyadan so'ng qayta urinib ko'ring.",
      },
      { status: 503 }
    );
  }
}