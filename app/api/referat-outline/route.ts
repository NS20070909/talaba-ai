import { NextResponse, NextRequest } from "next/server";
import { getUser } from "@/lib/storage";
import { PLAN_LIMITS } from "@/lib/limits";
import { guardCheck, canUseReferat, incrementReferat } from "@/lib/limit-checker";
import { runGeminiWithFallback } from "@/lib/ai-fallback-runner";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL_CHAIN = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
   "gemini-2.0-flash",
  "gemini-2.5-flash-lite",
];

function cleanJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.substring(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3);
  return cleaned.trim();
}

export async function POST(req: NextRequest) {
  console.log("[API] Request received: POST /api/referat-outline");
  try {
    const { topic, subject, language, pages, telegram_user_id } = await req.json();

    if (!topic || !subject || !language) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: topic, subject, or language",
        },
        { status: 400 }
      );
    }

    const telegramId = Number(telegram_user_id);
    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "telegram_user_id is required" },
        { status: 400 }
      );
    }

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
    let requestedMaxPages = 4; // default to FREE
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

    let planMinLimit = 3; // default to FREE
    let planMaxLimit = 4; // default to FREE
    let planName = "FREE";
    if (telegramId && !isNaN(telegramId)) {
      const user = await getUser(telegramId);
      planName = user ? user.plan : "FREE";
      const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.FREE;
      planMinLimit = limits.referatMinPages ?? 3;
      planMaxLimit = limits.unlimited ? Infinity : (limits.referatMaxPages ?? 4);
    }

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
          error: "Sizning bugungi referat yaratish limitingiz tugagan. Keyingi oyda yana urinib ko'ring.",
        },
        { status: 403 }
      );
    }

    const apiKey = process.env.REFERAT_GEMINI_API_KEY;
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
    });
    const cleaned = cleanJson(rawText);
    const parsedData = JSON.parse(cleaned);

    // Note: incrementReferat is intentionally NOT called here.
    // Usage is incremented strictly on successful completed DOCX generation in /api/write-referat.

    return NextResponse.json({
      success: true,
      model: usedModel,
      title: parsedData.title,
      outline: parsedData.outline,
    });
  } catch (error: any) {
    console.error("[Gemini] Referat Outline Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to generate outline",
      },
      { status: 500 }
    );
  }
}
