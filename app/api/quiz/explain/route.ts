import { NextResponse } from "next/server";
import { QuizQuestion } from "@/lib/quiz/types";
import { generateTargetedAiExplanations } from "@/lib/quiz/validator";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { questions } = (await req.json()) as { questions: QuizQuestion[] };
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, error: "Savollar topilmadi" }, { status: 400 });
    }

    const explainedQuestions = await generateTargetedAiExplanations(questions);
    return NextResponse.json({
      success: true,
      questions: explainedQuestions,
    });
  } catch (error: any) {
    console.error("Quiz explain API error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Tushuntirish yaratishda xatolik" },
      { status: 500 }
    );
  }
}
