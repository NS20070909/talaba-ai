import { QuizQuestion, ValidationIssue } from "./types";
import { runQuizModelChain, getQuizApiKey } from "./models";

export function validateQuestions(questions: QuizQuestion[]): {
  validatedQuestions: QuizQuestion[];
  overallValidation: {
    totalQuestions: number;
    validQuestions: number;
    flawedQuestions: number;
    issues: ValidationIssue[];
  };
} {
  const issuesList: ValidationIssue[] = [];
  const seenTexts = new Set<string>();
  let validCount = 0;
  let flawedCount = 0;

  const validatedQuestions = questions.map((q, idx) => {
    const issues: ValidationIssue[] = [];
    const normalizedText = q.text.trim().toLowerCase().replace(/\s+/g, " ");

    // 1. Empty Question
    if (!q.text || q.text.trim().length < 3) {
      issues.push({
        type: "EMPTY_QUESTION",
        message: "Savol matni judayam qisqa yoki bo'sh.",
        severity: "error",
      });
    }

    // 2. Duplicate Question
    if (seenTexts.has(normalizedText)) {
      issues.push({
        type: "DUPLICATE_QUESTION",
        message: "Ushbu savol testda qaytarilgan (takroriy).",
        severity: "warning",
      });
    } else if (normalizedText) {
      seenTexts.add(normalizedText);
    }

    // 3. Broken Numbering
    if (q.number && q.number !== idx + 1) {
      issues.push({
        type: "BROKEN_NUMBERING",
        message: `Savol raqamida nomutanosiblik (kutilgan: ${idx + 1}, mavjud: ${q.number}).`,
        severity: "info",
      });
    }

    // 4. Empty Option
    const emptyOpts = q.options.filter((o) => !o.text || o.text.trim().length === 0);
    if (emptyOpts.length > 0) {
      issues.push({
        type: "EMPTY_OPTION",
        message: `${emptyOpts.length} ta variat matni bo'sh.`,
        severity: "warning",
      });
    }

    // 5. Correct Answers Count
    const correctOpts = q.options.filter((o) => o.isCorrect);
    if (correctOpts.length === 0) {
      issues.push({
        type: "MISSING_ANSWER",
        message: "To'g'ri javob ko'rsatilmadi.",
        severity: "error",
      });
    } else if (correctOpts.length > 1) {
      issues.push({
        type: "MULTIPLE_CORRECT",
        message: `Bir nechta (${correctOpts.length} ta) to'g'ri javob ko'rsatilgan.`,
        severity: "warning",
      });
    }

    const hasErrorsOrWarnings = issues.some((i) => i.severity === "error" || i.severity === "warning");
    if (hasErrorsOrWarnings) {
      flawedCount++;
    } else {
      validCount++;
    }

    issuesList.push(...issues);

    return {
      ...q,
      validationIssues: issues,
    };
  });

  return {
    validatedQuestions,
    overallValidation: {
      totalQuestions: questions.length,
      validQuestions: validCount,
      flawedQuestions: flawedCount,
      issues: issuesList,
    },
  };
}

/**
 * Generate AI explanation ONLY for problematic questions to save tokens.
 */
export async function generateTargetedAiExplanations(
  questions: QuizQuestion[]
): Promise<QuizQuestion[]> {
  const apiKey = getQuizApiKey();
  if (!apiKey) return questions;

  const problematicQuestions = questions.filter(
    (q) => q.validationIssues && q.validationIssues.length > 0 && !q.explanation
  );

  if (problematicQuestions.length === 0) {
    return questions; // No AI call wasted on valid questions!
  }

  const prompt = `
For each problematic test question below, analyze the issue and generate a concise Uzbek explanation (1-2 sentences) explaining the correct answer or how to fix it.

Format response as JSON object mapping Question ID to explanation string:
{
  "q_id_1": "Explanation here..."
}

QUESTIONS WITH ISSUES:
${JSON.stringify(
  problematicQuestions.map((q) => ({
    id: q.id,
    question: q.text,
    options: q.options,
    issues: q.validationIssues?.map((i) => i.message),
  })),
  null,
  2
)}
`;

  try {
    const outputText = await runQuizModelChain([
      { role: "user", parts: [{ text: prompt }] },
    ]);

    const cleanText = outputText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const explanationsMap = JSON.parse(jsonMatch[0]);
      return questions.map((q) => {
        if (explanationsMap[q.id]) {
          return { ...q, explanation: explanationsMap[q.id] };
        }
        return q;
      });
    }
  } catch (err) {
    console.error("generateTargetedAiExplanations error:", err);
  }

  return questions;
}
