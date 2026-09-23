import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { incrementLiveSeconds, canUseLive } from "@/lib/limit-checker";
import { endLiveSession } from "@/lib/live-session-tracker";

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

function buildFallbackEvaluation(mode: string, durationSeconds: number) {
  if (mode === "ielts") {
    return {
      mode: "ielts",
      estimatedBand: "6.0",
      isAiEstimated: true,
      criteria: {
        fluency: "6.0",
        grammar: "6.0",
        vocabulary: "6.0",
        pronunciation: "6.0",
      },
      strengths: ["Suhbat muvaffaqiyatli yakunlandi", "Talaba savollarga faol javob berdi"],
      weaknesses: ["AI serverida vaqtincha yuqori talab tufayli batafsil grammatik tahlil cheklandi"],
      grammarCorrections: [],
      usefulVocabulary: ["Practice regularly", "Expand vocabulary range"],
      nextStep: "Keyingi mashg'ulotda batafsil tahlil olish uchun qayta sinab ko'ring",
      fallbackUsed: true,
    };
  } else if (mode === "interview") {
    return {
      mode: "interview",
      overallScore: "75%",
      communication: "Qoniqarli",
      confidence: "O'rtacha",
      answerQuality: "Umumiy",
      strengths: ["Suhbat muvaffaqiyatli yakunlandi", "Faol muloqot"],
      areasToImprove: ["Chuqurroq misollar keltirish"],
      recommendations: ["Keyingi sessiyada batafsil HR tahlilini olishingiz mumkin"],
      fallbackUsed: true,
    };
  } else if (mode === "exam") {
    return {
      mode: "exam",
      score: "75/100",
      grade: "Qoniqarli",
      mistakes: ["Batafsil tahlil vaqtincha yuklanmadi"],
      weakTopics: ["O'tilgan mavzularni umumiy takrorlash"],
      recommendations: "Imtihon savollarini mustaqil qayta takrorlang",
      fallbackUsed: true,
    };
  } else {
    return {
      mode: "casual",
      summary: `Jonli ovozli suhbat muvaffaqiyatli o'tkazildi (${durationSeconds} soniya).`,
      keyTopics: ["Jonli muloqot", "Ovozli amaliyot"],
      feedback: "Jonli ovozli suhbat uchun tashakkur! Muloqotni muntazam davom ettiring.",
      fallbackUsed: true,
    };
  }
}

async function generateWithTimeout(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  timeoutMs: number = 6000
) {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<null>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Model ${model} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  const apiPromise = ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  try {
    const res = await Promise.race([apiPromise, timeoutPromise]);
    return res;
  } finally {
    clearTimeout(timer!);
  }
}

export async function POST(request: Request) {
  let durationSeconds = 0;
  let remainingSeconds: number | undefined = undefined;
  let mode = "casual";

  try {
    const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI Chat kaliti sozlanmagan." },
        { status: 500 },
      );
    }

    const body = await request.json().catch(() => ({}));
    mode = body.mode || "casual";
    const { persona, transcript = [] } = body;

    // 1. Strict telegram_id validation
    const telegramId = Number(body.telegram_id);
    if (!telegramId || isNaN(telegramId) || telegramId <= 0) {
      return NextResponse.json(
        { error: "Avtorizatsiyadan o'ting yoki Telegram orqali kiring." },
        { status: 401 },
      );
    }

    // 2. Server-side authoritative duration calculation & anti-double-deduction
    const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
    const rawClientDuration = Number(body.durationSeconds);
    const clientDuration = !isNaN(rawClientDuration) && rawClientDuration >= 0 ? rawClientDuration : undefined;

    if (sessionId) {
      const sessionResult = await endLiveSession(sessionId, telegramId, clientDuration);
      durationSeconds = sessionResult.totalCreditedSeconds;
      remainingSeconds = sessionResult.remainingSeconds;
    } else {
      // Fallback if no sessionId provided: clamp duration safely against remaining allowance
      const liveStatus = await canUseLive(telegramId);
      const safeDuration = Math.min(60 * 60, Math.max(0, Math.round(clientDuration || 0)));
      if (safeDuration > 0 && liveStatus.remainingSeconds > 0) {
        const toCredit = Math.min(safeDuration, liveStatus.remainingSeconds);
        await incrementLiveSeconds(telegramId, toCredit);
        durationSeconds = toCredit;
      }
      const updatedStatus = await canUseLive(telegramId);
      remainingSeconds = updatedStatus.remainingSeconds;
    }

    if (!Array.isArray(transcript) || transcript.length < 2) {
      return NextResponse.json({
        success: true,
        shortSession: true,
        durationSeconds,
        remainingSeconds,
        message: "Suhbat juda qisqa bo'ldi. To'liq baholash uchun kamida bir necha savol-javob o'tkazish tavsiya etiladi.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const transcriptText = transcript
      .map((t: any) => `${t.role === "user" ? "Foydalanuvchi/Talaba" : "AI Mentor"}: ${t.text}`)
      .join("\n");

    let prompt = "";

    if (mode === "ielts") {
      prompt = `Quyida talaba bilan o'tkazilgan IELTS Speaking sinovi transkripti berilgan (Davomiyligi: ${durationSeconds} soniya):
${transcriptText}

Siz sertifikatlangan IELTS Examiner sifatida talabaning javoblarini xolisona tahlil qiling.
Javobni FAQAT toza JSON formatida bering:
{
  "mode": "ielts",
  "estimatedBand": "6.5",
  "isAiEstimated": true,
  "criteria": {
    "fluency": "7.0",
    "grammar": "6.5",
    "vocabulary": "6.5",
    "pronunciation": "6.5"
  },
  "strengths": ["Kuchli tomonlari"],
  "weaknesses": ["Kamchiliklar"],
  "grammarCorrections": [
    { "original": "Xato gap", "corrected": "To'g'ri variant", "rule": "Qoida" }
  ],
  "usefulVocabulary": ["Foydali akademik so'zlar va iboralar"],
  "nextStep": "Keyingi mashg'ulot bo'yicha tavsiya"
}`;
    } else if (mode === "interview") {
      prompt = `Quyida talaba bilan o'tkazilgan Interview (ish/grant suhbati) transkripti berilgan (Davomiyligi: ${durationSeconds} soniya):
${transcriptText}

Siz Senior HR mutaxassisi sifatida baholang.
Javobni FAQAT toza JSON formatida bering:
{
  "mode": "interview",
  "overallScore": "85%",
  "communication": "Yaxshi",
  "confidence": "Yuqori",
  "answerQuality": "Strukturali",
  "strengths": ["Kuchli jihatlari"],
  "areasToImprove": ["Rivojlantirish kerak bo'lgan tomonlar"],
  "recommendations": ["Aniq amaliy tavsiyalar"]
}`;
    } else if (mode === "exam") {
      prompt = `Quyida talaba bilan o'tkazilgan Og'zaki Imtihon transkripti berilgan (Davomiyligi: ${durationSeconds} soniya):
${transcriptText}

Siz universitet professori sifatida baholang.
Javobni FAQAT toza JSON formatida bering:
{
  "mode": "exam",
  "score": "80/100",
  "grade": "Yaxshi",
  "mistakes": ["Yo'l qo'yilgan xatolar"],
  "weakTopics": ["Takrorlash kerak bo'lgan mavzular"],
  "recommendations": "Bilimlarni mustahkamlash uchun tavsiya"
}`;
    } else {
      prompt = `Quyida talaba bilan o'tkazilgan Jonli Ovozli Suhbat transkripti berilgan (Davomiyligi: ${durationSeconds} soniya):
${transcriptText}

Suhbatni qisqacha xulosalang va foydalanuvchiga fikr bildiring.
Javobni FAQAT toza JSON formatida bering:
{
  "mode": "casual",
  "summary": "Suhbatning asosiy mavzulari va qisqa xulosasi",
  "keyTopics": ["Mavzular"],
  "feedback": "Do'stona tavsiya va fikr"
}`;
    }

    let evaluation: any = null;
    let lastErr: any = null;

    for (const model of TEXT_MODELS) {
      try {
        const start = Date.now();
        const res = await generateWithTimeout(ai, model, prompt, 6000);
        if (res && res.text && res.text.trim()) {
          const raw = res.text.trim();
          try {
            evaluation = JSON.parse(raw);
          } catch {
           const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
              evaluation = JSON.parse(match[0]);
            }
          }
          if (evaluation) {
            console.log(`[Live Session] Evaluated via ${model} in ${Date.now() - start}ms`);
            break;
          }
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Live Session] Model ${model} attempt failed (${err?.message || err}), trying next...`);
      }
    }

    if (!evaluation) {
      console.warn("[Live Session] All models failed or timed out. Returning fallback evaluation:", lastErr?.message || lastErr);
      evaluation = buildFallbackEvaluation(mode, durationSeconds);
    }

    return NextResponse.json({
      success: true,
      durationSeconds,
      remainingSeconds,
      evaluation,
      fallbackUsed: Boolean(evaluation.fallbackUsed),
    });
  } catch (error: any) {
    console.error("[Live Session Result Error]:", error);
    // Even on unexpected error, return fallback evaluation with 200 so UI flow never crashes
    return NextResponse.json({
      success: true,
      durationSeconds,
      remainingSeconds,
      evaluation: buildFallbackEvaluation(mode, durationSeconds),
      fallbackUsed: true,
      error: error?.message || "Kutilmagan xatolik yuz berdi.",
    });
  }
}
