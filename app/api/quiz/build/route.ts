import { NextResponse } from "next/server";
import { QuizQuestion, QuizConfig } from "@/lib/quiz/types";
import { buildQuizSelection, buildQuizCollection, smartRandomSelect, splitQuizIntoBatches } from "@/lib/quiz/random-engine";
import { recommendQuizConfig } from "@/lib/quiz/auto-builder";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { questions, config, autoBuild, sourceFileName } = (await req.json()) as {
      questions: QuizQuestion[];
      config: QuizConfig;
      autoBuild?: boolean;
      sourceFileName?: string;
    };

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { success: false, error: "No questions provided" },
        { status: 400 }
      );
    }

    // Auto-builder recommendation requested
    if (autoBuild) {
      const recommendation = await recommendQuizConfig(questions, sourceFileName);
      return NextResponse.json({
        success: true,
        recommendation,
      });
    }

    // Handle MULTI mode collection generation
    if (config?.builderMode === "MULTI") {
      const collection = buildQuizCollection(questions, config);
      return NextResponse.json({
        success: true,
        collection,
        questions: collection.testSets.flatMap((s) => s.questions),
        totalCount: collection.totalQuestions,
        batchCount: collection.testSets.length,
      });
    }

    let targetQuestions = [...questions];

    // Smart Random algorithm
    if (config.selectionMode === "SMART_RANDOM" && config.targetCount && config.targetCount < targetQuestions.length) {
      targetQuestions = await smartRandomSelect(targetQuestions, config.targetCount);
    }

    // Apply Range, Random, Shuffle Questions & Options
    const builtQuestions = buildQuizSelection(targetQuestions, config);

    // Split batches if requested
    const batches = config.splitBatchSize
      ? splitQuizIntoBatches(builtQuestions, config.splitBatchSize)
      : [builtQuestions];

    return NextResponse.json({
      success: true,
      questions: builtQuestions,
      batches,
      totalCount: builtQuestions.length,
      batchCount: batches.length,
    });
  } catch (error: any) {
    console.error("Quiz Build API error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Quiz yaratishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
