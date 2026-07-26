import { NextRequest, NextResponse } from "next/server";
import { guardCheck } from "@/lib/limit-checker";
import { runGeminiWithFallback } from "@/lib/ai-fallback-runner";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MODEL_CHAIN = [
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
];

const getLanguageInstruction = (lang: string) => {
  if (lang === "tg") {
    return "Write entirely in the Tajik language. IMPORTANT: Maintain the academic and institutional context of the Republic of Uzbekistan (O'zbekiston Respublikasi, Uzbek universities, laws, and ministries). Do NOT switch to Tajikistan context.";
  }
  if (lang === "ru") return "Write entirely in the Russian language.";
  if (lang === "en") return "Write entirely in the English language.";
  return "Write entirely in the Uzbek language.";
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, topic, subject, language, outline, telegram_user_id } = body;

    if (!topic || !type) {
      return NextResponse.json({ success: false, error: "Topic and type are required" }, { status: 400 });
    }

    const telegramId = Number(telegram_user_id);
    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json({ success: false, error: "telegram_user_id is required" }, { status: 400 });
    }

    const guard = await guardCheck(telegramId);
    if (guard.blocked) {
      return NextResponse.json(
        { success: false, error: guard.result?.banned ? "🚫 Siz bloklangansiz" : "Ruxsat etilmagan" },
        { status: 403 }
      );
    }

    const apiKey = process.env.REFERAT_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "REFERAT_GEMINI_API_KEY topilmadi" }, { status: 500 });
    }

    const langInstruction = getLanguageInstruction(language || "uz");
    const outlineContext = Array.isArray(outline) && outline.length > 0 ? `Outline: ${outline.join("; ")}` : "";

    let prompt = "";

    if (type === "quiz") {
      prompt = `You are an expert academic professor. Generate a comprehensive study quiz based on the referat topic "${topic}" and subject "${subject || "General"}".
${outlineContext}
${langInstruction}

Requirements:
1. Generate 10 Multiple Choice Questions (MCQ) with options A, B, C, D.
2. Generate 5 Short Answer Questions for deep understanding.
3. Provide a clear Answer Key (Javoblar kaliti) at the very end.
Format nicely with clean section headers and clear numbering.`;
    } else if (type === "summary") {
      prompt = `You are an expert academic professor. Generate a high-quality 1-2 page study summary (Konspekt) for the referat topic "${topic}" and subject "${subject || "General"}".
${outlineContext}
${langInstruction}

Requirements:
1. Asosiy Qisqacha Mazmun (Summary of core ideas)
2. Muhim Tushunchalar va Atamalar (Key terms & definitions)
3. Muhim Formulalar va Qoidalar (Key rules/formulas/theorems if applicable)
4. Kalit So'zlar (Key words)
Format nicely with clean section headers and bullet points.`;
    } else if (type === "defense") {
      prompt = `You are an expert academic examiner and professor. Generate a defense preparation guide (Himoya savollari va tavsiyalar) for a student presenting a referat on "${topic}".
${outlineContext}
${langInstruction}

Requirements:
1. 10 Probable Exam/Defense Questions that professors will ask.
2. Clear, concise Model Answers for each question.
3. 5 Practical Tips for a successful defense presentation.
Format nicely with clear numbering and section headers.`;
    } else if (type === "grade") {
      prompt = `You are an expert academic professor and evaluator. Provide a comprehensive academic evaluation for a student referat on the topic: "${topic}", subject: "${subject || "General"}".
${outlineContext}
${langInstruction}

Provide the evaluation with exactly these sections:
1. 📊 Umumiy Baho (Overall Score): X/100 — give a specific integer score and one-sentence justification.
2. ✅ Kuchli Tomonlari (Strengths): List 3-5 specific, genuine strong points.
3. ⚠️ Kamchiliklari (Weaknesses): List 3-5 concrete areas needing improvement.
4. 💡 Yaxshilash Tavsiyalari (Recommendations): Give 4-6 specific, actionable suggestions.
5. 🎓 Akademik Uslub Bahosi (Academic Style): X/10 with brief comment.
6. 🔗 Mantiqiy Ketma-ketlik (Logical Flow): X/10 with brief comment.
Be fair, specific, and constructive. Format with clear section headers.`;
    } else {
      return NextResponse.json({ success: false, error: "Invalid study pack type" }, { status: 400 });
    }

    const { text } = await runGeminiWithFallback({
      apiKey,
      modelChain: MODEL_CHAIN,
      prompt,
    });

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: "AI javob qaytarmadi" }, { status: 500 });
    }

    return NextResponse.json({ success: true, text: text.trim() });
  } catch (error: any) {
    console.error("[referat-study-pack] Error:", error?.message || error);
    return NextResponse.json({ success: false, error: "Xatolik yuz berdi" }, { status: 500 });
  }
}
