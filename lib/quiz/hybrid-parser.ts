import { parseQuizWithRuleEngine } from "./rule-parser";
import { parseQuizWithAi } from "./ai-parser";
import { validateQuestions, generateTargetedAiExplanations } from "./validator";
import { ParsedQuizResult, QuizQuestion } from "./types";

export async function parseQuizHybrid(
  rawText: string,
  fileName?: string
): Promise<ParsedQuizResult> {
  const totalStartTime = Date.now();
  const normalized = rawText.trim();

  if (!normalized) {
    return {
      title: fileName ? fileName.replace(/\.[^/.]+$/, "") : "Quiz",
      sourceFileName: fileName,
      rawText: "",
      questions: [],
      overallValidation: {
        totalQuestions: 0,
        validQuestions: 0,
        flawedQuestions: 0,
        issues: [],
      },
      parserMethod: "RULE",
    };
  }

  // Stage 1: Rule Engine / Regex Parser
  const ruleStartTime = Date.now();
  let questions: QuizQuestion[] = parseQuizWithRuleEngine(normalized);
  const ruleTime = Date.now() - ruleStartTime;
  let parserMethod: "RULE" | "REGEX" | "HYBRID_AI" | "OCR" = "RULE";

  // Stage 2: Validate Rule-parsed result
  const valStartTime = Date.now();
  let { validatedQuestions, overallValidation } = validateQuestions(questions);
  const valTime = Date.now() - valStartTime;

  // Stage 3: Check if AI parsing is strictly required
  // Call Gemini ONLY IF < 2 valid questions OR > 35% flawed questions
  const isPoorResult =
    validatedQuestions.length < 2 ||
    (validatedQuestions.length > 0 && overallValidation.flawedQuestions / validatedQuestions.length > 0.35);

  let aiTime = 0;
  if (isPoorResult) {
    const aiStartTime = Date.now();
    console.warn(`[Quiz Hybrid Parser] Rule parser returned inadequate results (${validatedQuestions.length} valid). Invoking Gemini AI parser...`);
    try {
      const aiQuestions = await parseQuizWithAi(normalized);
      if (aiQuestions.length >= validatedQuestions.length) {
        questions = aiQuestions;
        parserMethod = "HYBRID_AI";
        const reVal = validateQuestions(questions);
        validatedQuestions = reVal.validatedQuestions;
        overallValidation = reVal.overallValidation;
      }
    } catch (err: any) {
      console.error("[Quiz Hybrid Parser] Gemini AI parser fallback error:", err?.message || err);
    }
    aiTime = Date.now() - aiStartTime;
  } else {
    console.log(`[Quiz Hybrid Parser] Rule/Regex parser succeeded (${validatedQuestions.length} valid questions). Gemini AI parser call skipped.`);
  }

  // Stage 4: Generate targeted AI explanations ONLY for problematic questions (capped)
  const expStartTime = Date.now();
  if (validatedQuestions.length > 0 && validatedQuestions.length <= 50) {
    validatedQuestions = await generateTargetedAiExplanations(validatedQuestions);
  }
  const expTime = Date.now() - expStartTime;

  const totalTime = Date.now() - totalStartTime;

  console.log(
    `[Quiz Hybrid Parser Timings] Total: ${totalTime}ms | Rule Engine: ${ruleTime}ms | Validation: ${valTime}ms | Gemini AI Parser: ${aiTime}ms | AI Explanations: ${expTime}ms`
  );

  const defaultTitle = fileName
    ? fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : "AI Generated Quiz";

  return {
    title: defaultTitle,
    sourceFileName: fileName,
    rawText: normalized,
    questions: validatedQuestions,
    overallValidation,
    parserMethod,
  };
}
