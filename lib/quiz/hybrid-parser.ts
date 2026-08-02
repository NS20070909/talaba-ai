import { parseQuizWithRuleEngine } from "./rule-parser";
import { parseQuizWithAi } from "./ai-parser";
import { validateQuestions } from "./validator";
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

  console.log(`[Upload] File received: ${fileName || "Text input"} (${normalized.length} chars)`);

  // Stage 1: Code-First Rule Engine / Regex Parser
  const ruleStartTime = Date.now();
  let questions: QuizQuestion[] = parseQuizWithRuleEngine(normalized);
  const ruleTime = Date.now() - ruleStartTime;
  let parserMethod: "RULE" | "REGEX" | "HYBRID_AI" | "OCR" = "RULE";

  console.log(`[Rule Parser] Executed in ${ruleTime}ms. Found ${questions.length} questions.`);

  // Stage 2: Validation
  const valStartTime = Date.now();
  let { validatedQuestions, overallValidation } = validateQuestions(questions);
  const valTime = Date.now() - valStartTime;

  console.log(`[Validation] Completed in ${valTime}ms. Valid: ${validatedQuestions.length}, Flawed: ${overallValidation.flawedQuestions}`);

  // Stage 3: AI Parser ONLY if Rule Parser returned < 2 valid questions
  const isPoorResult = validatedQuestions.length < 2;
  let aiTime = 0;

  if (isPoorResult) {
    const aiStartTime = Date.now();
    console.warn(`[Parser] Rule parser returned insufficient questions (${validatedQuestions.length}). Invoking Gemini AI parser...`);
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
      console.error("[Parser] Gemini AI parser error:", err?.message || err);
    }
    aiTime = Date.now() - aiStartTime;
    console.log(`[AI] Parser completed in ${aiTime}ms.`);
  } else {
    console.log(`[Parser] Rule Parser succeeded with ${validatedQuestions.length} questions. Gemini AI skipped completely (0 AI cost).`);
  }

  const totalTime = Date.now() - totalStartTime;

  console.log(
    `[Quiz Pipeline] Total: ${totalTime}ms | Rule Parser: ${ruleTime}ms | Validation: ${valTime}ms | Gemini AI: ${aiTime}ms`
  );

  const defaultTitle = fileName
    ? fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : "Quiz Test";

  return {
    title: defaultTitle,
    sourceFileName: fileName,
    rawText: normalized,
    questions: validatedQuestions,
    overallValidation,
    parserMethod,
  };
}
