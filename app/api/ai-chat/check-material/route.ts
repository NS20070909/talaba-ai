import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { canUseQuiz, incrementQuiz } from "@/lib/limit-checker";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEXT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

async function callGemini(ai: GoogleGenAI, contents: any[], config?: Record<string, any>) {
  let lastErr: any = null;
  for (const model of TEXT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config,
      });
      if (response.text?.trim()) {
        return response;
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[Check Material] Model ${model} failed, trying fallback:`, err);
    }
  }
  throw lastErr || new Error("Gemini javob bermadi.");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI Chat kaliti sozlanmagan." },
        { status: 500 },
      );
    }

    const contentType = request.headers.get("content-type") || "";

    // ── FLOW A: JSON requests (AI o'zi test tuzishi yoki javoblarni baholash) ──
    if (contentType.includes("application/json")) {
      const body = await request.json();
      const action = body.action;

      const ai = new GoogleGenAI({ apiKey });

      if (action === "generate_questions") {
        const { subject, topic, difficulty = "O'rta", count = 5, telegram_id } = body;

        // 1. Strict telegram_id validation
        const telegramId = Number(telegram_id);
        if (!telegramId || isNaN(telegramId) || telegramId <= 0) {
          return NextResponse.json(
            { error: "Avtorizatsiyadan o'ting yoki Telegram orqali kiring." },
            { status: 401 },
          );
        }

        // 2. Check quiz daily quota
        const quizCheck = await canUseQuiz(telegramId);
        if (quizCheck.banned) {
          return NextResponse.json(
            { error: "Profilingiz bloklangan.", banned: true },
            { status: 403 },
          );
        }
        if (!quizCheck.allowed) {
          return NextResponse.json(
            {
              error: "Bugungi test va material tekshirish limitingiz tugagan. Yangilash uchun Premium tarifga o'ting ⭐",
              limitReached: true,
            },
            { status: 403 },
          );
        }

        if (!subject || !topic) {
          return NextResponse.json(
            { error: "Fan va mavzuni kiriting." },
            { status: 400 },
          );
        }

        const prompt = `Siz Talaba AI imtihon va test mutaxassisisiz.
Foydalanuvchi:
Fan: "${subject}"
Mavzu: "${topic}"
Qiyinlik darajasi: "${difficulty}"
Savollar soni: ${count}

Talabaning bilimini tekshirish uchun aynan ${count} ta test savolini tuzing.
Javobni FAQAT toza JSON formatida bering (hech qanday markdown \`\`\`json belgisiz, faqat valid JSON obyekt):
{
  "subject": "${subject}",
  "topic": "${topic}",
  "questions": [
    {
      "id": 1,
      "question": "Savol matni",
      "options": ["A) Variant 1", "B) Variant 2", "C) Variant 3", "D) Variant 4"],
      "correctAnswer": "A",
      "explanation": "Nima uchun to'g'riligining qisqa tushuntirishi"
    }
  ]
}`;

        const response = await callGemini(
          ai,
          [{ role: "user", parts: [{ text: prompt }] }],
          {
            temperature: 0.3,
            responseMimeType: "application/json",
          }
        );

        const rawText = response.text?.trim() || "{}";
        let parsed;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) {
            parsed = JSON.parse(match[0]);
          } else {
            throw new Error("Savollarni JSON formatida o'qib bo'lmadi.");
          }
        }

        // Increment quiz usage ONLY upon successful generation
        await incrementQuiz(telegramId).catch((err) => {
          console.warn("[Check Material] Failed to increment quiz count:", err);
        });

        return NextResponse.json({ success: true, data: parsed });
      }

      if (action === "evaluate_answers") {
        const { subject, topic, questions, userAnswers, telegram_id } = body;
        const telegramId = Number(telegram_id);
        if (!telegramId || isNaN(telegramId) || telegramId <= 0) {
          return NextResponse.json(
            { error: "Avtorizatsiyadan o'ting yoki Telegram orqali kiring." },
            { status: 401 },
          );
        }

        if (!Array.isArray(questions) || !userAnswers) {
          return NextResponse.json(
            { error: "Savollar va javoblar to'liq emas." },
            { status: 400 },
          );
        }

        const prompt = `Talaba "${subject}" fanidan "${topic}" mavzusidagi test savollariga javob berdi.
Savollar va to'g'ri javoblar:
${JSON.stringify(questions, null, 2)}

Talabaning bergan javoblari:
${JSON.stringify(userAnswers, null, 2)}

Talabaning natijasini batafsil va professional tahlil qiling.
Javobni FAQAT toza JSON formatida bering:
{
  "totalQuestions": ${questions.length},
  "correctCount": 0,
  "wrongCount": 0,
  "scorePercent": 0,
  "grade": "A'lo / Yaxshi / Qoniqarli / Qoniqarsiz",
  "mistakes": [
    {
      "questionId": 1,
      "question": "Savol",
      "userAnswer": "Talaba javobi",
      "correctAnswer": "To'g'ri javob",
      "explanation": "Qayerda adashgan va to'g'ri yechim qanday"
    }
  ],
  "weakTopics": ["Talaba qiynalgan aniq kichik mavzular"],
  "recommendation": "Talabaga bilimini oshirish uchun aniq amaliy maslahatlar"
}`;

        const response = await callGemini(
          ai,
          [{ role: "user", parts: [{ text: prompt }] }],
          {
            temperature: 0.2,
            responseMimeType: "application/json",
          }
        );

        const rawText = response.text?.trim() || "{}";
        const parsed = JSON.parse(rawText);
        return NextResponse.json({ success: true, evaluation: parsed });
      }

      return NextResponse.json({ error: "Noma'lum harakat." }, { status: 400 });
    }

    // ── FLOW B: FormData file upload (PDF yoki Surat orqali tekshirish) ──
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const userAnswersText = (formData.get("userAnswers") as string) || "";
      const telegramId = Number(formData.get("telegram_id"));

      // 1. Strict telegram_id validation
      if (!telegramId || isNaN(telegramId) || telegramId <= 0) {
        return NextResponse.json(
          { error: "Avtorizatsiyadan o'ting yoki Telegram orqali kiring." },
          { status: 401 },
        );
      }

      // 2. Check quiz daily quota
      const quizCheck = await canUseQuiz(telegramId);
      if (quizCheck.banned) {
        return NextResponse.json(
          { error: "Profilingiz bloklangan.", banned: true },
          { status: 403 },
        );
      }
      if (!quizCheck.allowed) {
        return NextResponse.json(
          {
            error: "Bugungi test va material tekshirish limitingiz tugagan. Yangilash uchun Premium tarifga o'ting ⭐",
            limitReached: true,
          },
          { status: 403 },
        );
      }

      if (!file) {
        return NextResponse.json(
          { error: "Fayl yuklanmadi. PDF yoki rasm tanlang." },
          { status: 400 },
        );
      }

      const mimeType = file.type || "application/octet-stream";
      const allowedMimes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
      ];

      if (!allowedMimes.includes(mimeType)) {
        return NextResponse.json(
          { error: "Faqat PDF, PNG, JPG yoki JPEG formatidagi fayllar qabul qilinadi." },
          { status: 400 },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString("base64");

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Siz Talaba AI ning O'quv Nazoratchisi va Imtihon Ekspertisiz.
Quyida talaba tomonidan yuklangan o'quv materiali (bilet, test varaqasi, masala yoki imtihon savollari) taqdim etilgan.
${userAnswersText ? `Talabaning o'zi yozgan javoblari / izohi:\n"${userAnswersText}"` : "Talaba materialdagi barcha savollarni topib, ularni to'g'ri yechib va tushuntirib berishingizni so'ramoqda."}

Vazifangiz:
1. Hujjat/rasmdagi barcha savollar, topshiriqlar yoki misollarni aniqlang.
2. Agar talaba o'z javoblarini yozgan bo'lsa: qaysi biri to'g'ri, qaysi biri xatoligini tekshiring, ball qo'ying.
3. Agar talaba javob yozmagan bo'lsa: har bir savolga bosqichma-bosqich aniq va to'g'ri yechim bering.
4. Xatolar va tushunarsiz joylar bo'yicha tushuntirish bering.
5. Talabaga tavsiyalar bering.

Javobni chiroyli, tartibli o'zbek tilida, markdown formatida tuzing:
- 📋 **Aniqlangan savollar soni va ro'yxati**
- 🎯 **Tekshirish natijalari (Agar javob berilgan bo'lsa: To'g'ri/Xato soni, foiz)**
- 💡 **Har bir savolning to'g'ri yechimi va tushuntirishi**
- ⚠️ **Asosiy xatolar va zaif nuqtalar**
- 🚀 **Kelgusi o'rganish uchun tavsiyalar**`;

      const response = await callGemini(
        ai,
        [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        {
          temperature: 0.2,
          maxOutputTokens: 3_500,
        }
      );

      const text = response.text?.trim();
      if (!text) {
        throw new Error("Gemini materialni tahlil qila olmadi.");
      }

      // Increment quiz usage ONLY upon successful generation
      await incrementQuiz(telegramId).catch((err) => {
        console.warn("[Check Material File] Failed to increment quiz count:", err);
      });

      return NextResponse.json({
        success: true,
        fileName: file.name,
        result: text,
      });
    }

    return NextResponse.json({ error: "Unsupported Content-Type" }, { status: 400 });
  } catch (error: any) {
    console.error("[Check Material Error]:", error);
    const is503 = error?.status === 503 ||
      error?.statusCode === 503 ||
      error?.message?.includes("503") ||
      error?.message?.includes("UNAVAILABLE") ||
      error?.message?.includes("high demand");

    if (is503) {
      return NextResponse.json(
        {
          success: false,
          error: "SERVICE_UNAVAILABLE",
          message: "⚠️ AI hozir band. Iltimos, bir necha soniyadan keyin qayta urinib ko‘ring.",
        },
        { status: 503 },
      );
    }

    const message = error instanceof Error ? error.message : "Materialni tekshirishda xatolik yuz berdi.";
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
