import { parseQuizWithRuleEngine } from "./rule-parser";
import { parseQuizWithAi } from "./ai-parser";
import { validateQuestions, generateTargetedAiExplanations } from "./validator";
import { ParsedQuizResult, QuizQuestion } from "./types";

export async function parseQuizHybrid(
  rawText: string,
  fileName?: string
): Promise<ParsedQuizResult> {
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

  // Step 1: Rule Engine / Regex Parser
  let questions: QuizQuestion[] = parseQuizWithRuleEngine(normalized);
  let parserMethod: "RULE" | "REGEX" | "HYBRID_AI" | "OCR" = "RULE";

  // Step 2: Validate Rule-parsed result
  let { validatedQuestions, overallValidation } = validateQuestions(questions);

  // Step 3: Check if AI parsing is required (if < 2 questions found or > 40% flawed)
  const isPoorResult =
    validatedQuestions.length < 2 ||
    (validatedQuestions.length > 0 && overallValidation.flawedQuestions / validatedQuestions.length > 0.4);

  if (isPoorResult) {
    console.warn("Rule parser returned inadequate results. Invoking Gemini AI parser for unparsed text...");
    try {
      const aiQuestions = await parseQuizWithAi(normalized);
      if (aiQuestions.length >= validatedQuestions.length) {
        questions = aiQuestions;
        parserMethod = "HYBRID_AI";
        const reVal = validateQuestions(questions);
        validatedQuestions = reVal.validatedQuestions;
        overallValidation = reVal.overallValidation;
      }
    } catch (err) {
      console.error("Hybrid AI parser fallback error:", err);
    }
  }

  // Step 4: Generate AI explanations ONLY for remaining problematic questions
  validatedQuestions = await generateTargetedAiExplanations(validatedQuestions);

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
