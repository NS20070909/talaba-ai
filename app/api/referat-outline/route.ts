import { NextResponse, NextRequest } from "next/server";
import { PLAN_LIMITS } from "@/lib/limits";
import { guardCheck, canUseReferat } from "@/lib/limit-checker";
import { getVerifiedTelegramUser } from "@/lib/telegram-auth";
import { runGeminiWithFallback } from "@/lib/ai-fallback-runner";

export const maxDuration = 35;
export const dynamic = "force-dynamic";

const MODEL_CHAIN = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

function cleanJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3);
  cleaned = cleaned.trim();

  // Extract outer JSON object if extra text exists
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Yaroqsiz so'rov ma'lumotlari." },
        { status: 400 }
      );
    }

    const { topic, subject, language, pages } = body;

    if (!topic || !subject || !language) {
      return NextResponse.json(
        {
          success: false,
          error: "Barcha maydonlarni to'ldiring: topic, subject, yoki language yetishmayapti",
        },
        { status: 400 }
      );
    }

    const auth = await getVerifiedTelegramUser(req, body);
    if (!auth.authenticated || !auth.telegramId) {
      return NextResponse.json(
        { success: false, error: "Avtorizatsiya talab qilinadi. Telegram orqali kiring." },
        { status: 401 }
      );
    }

    const telegramId = auth.telegramId;

    const guard = await guardCheck(telegramId);
    if (guard.blocked) {
      return NextResponse.json(
        {
          success: false,
          error: guard.result?.banned ? "🚫 Siz bloklangansiz" : "Ruxsat etilmagan",
        },
        { status: 403 }
      );
    }

    // Backend validation of pages count
    let requestedMaxPages = 4;
    if (typeof pages === "string") {
      if (pages.toLowerCase() === "cheksiz") {
        requestedMaxPages = Infinity;
      } else {
        const parts = pages.split("-");
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart.replace("+", ""), 10);
        if (!isNaN(parsed)) {
          requestedMaxPages = parsed;
        }
      }
    } else if (typeof pages === "number") {
      requestedMaxPages = pages;
    }

    const user = guard.user;
    const planName = user ? user.plan : "FREE";
    const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.FREE;
    const planMinLimit = limits.referatMinPages ?? 3;
    const planMaxLimit = limits.unlimited ? Infinity : (limits.referatMaxPages ?? 4);

    if (requestedMaxPages > planMaxLimit || requestedMaxPages < planMinLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `Sizning tarifingizda referat sahifalar soni cheklangan. Ruxsat etilgan diapazon: ${planMinLimit}-${planMaxLimit === Infinity ? "Cheksiz" : planMaxLimit} bet. (Tarif: ${planName}).`,
        },
        { status: 403 }
      );
    }

    // Check daily referat limit count
    const limitCheck = await canUseReferat(telegramId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Sizning bugungi referat yaratish limitingiz tugagan. Ertaga yangilanadi yoki tarifingizni oshiring.",
        },
        { status: 403 }
      );
    }

    const apiKey = process.env.REFERAT_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "REFERAT_GEMINI_API_KEY topilmadi",
        },
        { status: 500 }
      );
    }

    const getLanguageNote = (lang: string) => {
      if (lang === "tg") {
        return "Tajik language. IMPORTANT: Maintain the academic and institutional context of the Republic of Uzbekistan (O'zbekiston Respublikasi, Uzbek universities, laws, and ministries). Do NOT switch to Tajikistan context.";
      }
      return lang;
    };

    const prompt = `You are an expert academic writer and professor.
Your task is to create a highly professional, well-structured academic outline for a referat (research paper/essay).

Topic: ${topic}
Subject: ${subject}
Language: ${getLanguageNote(language)}
Expected Length: ${pages} pages

Requirements:
1. Output ONLY a valid JSON object. Do NOT include markdown code blocks (like \`\`\`json) or any other text.
2. The JSON must exactly match this structure:
{
  "title": "A professional and engaging title for the referat",
  "outline": [
    "Introduction: (Briefly describe what will be covered)",
    "1. Main point 1: (Detail)",
    "2. Main point 2: (Detail)",
    "Conclusion: (Summary of findings)",
    "References"
  ]
}
3. The response must be entirely in the requested Language (${getLanguageNote(language)}).
4. Ensure the outline depth is appropriate for a paper of ${pages} pages.`;

    const { text: rawText, model: usedModel } = await runGeminiWithFallback({
      apiKey,
      modelChain: MODEL_CHAIN,
      prompt,
      perModelTimeoutMs: 8000,
      maxRetriesPerModel: 1,
      maxTotalMs: 26000,
    });

    const cleaned = cleanJson(rawText);
    const parsedData = JSON.parse(cleaned);

    return NextResponse.json({
      success: true,
      model: usedModel,
      title: parsedData.title,
      outline: parsedData.outline,
    });
  } catch (error: any) {
    const errorMsg = error?.message || "";
    console.error("[Referat Outline] Error:", errorMsg);

    const isTimeout =
      errorMsg.includes("Timeout") ||
      errorMsg.includes("timeout") ||
      errorMsg.includes("abort");

    if (isTimeout) {
      return NextResponse.json(
        {
          success: false,
          error: "⏳ Reja tuzish vaqti tugadi (server band). Iltimos, qayta urinib ko'ring.",
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Referat rejasini tuzishda xatolik yuz berdi",
      },
      { status: 503 }
    );
  }
}
