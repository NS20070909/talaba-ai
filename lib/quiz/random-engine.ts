import { QuizQuestion, QuizConfig } from "./types";
import { runQuizModelChain } from "./models";

/**
 * Fisher-Yates shuffle array helper
 */

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleQuestionOptions(question: QuizQuestion): QuizQuestion {
  const shuffledOpts = shuffleArray(question.options);
  return {
    ...question,
    options: shuffledOpts,
  };
}

export function buildQuizSelection(
  questions: QuizQuestion[],
  config: QuizConfig
): QuizQuestion[] {
  let selected = [...questions];

  // 1. Question Range filter
  if (config.selectionMode === "RANGE") {
    const start = Math.max(1, config.rangeStart || 1) - 1;
    const end = Math.min(questions.length, config.rangeEnd || questions.length);
    selected = selected.slice(start, end);
  }

  // 2. Manual Selection filter
  if (config.selectionMode === "MANUAL" && config.selectedQuestionIds?.length) {
    const idSet = new Set(config.selectedQuestionIds);
    selected = selected.filter((q) => idSet.has(q.id));
  }

  // 3. Simple Random
  if (config.selectionMode === "RANDOM") {
    selected = shuffleArray(selected);
    if (config.targetCount && config.targetCount < selected.length) {
      selected = selected.slice(0, config.targetCount);
    }
  }

  // 4. Shuffle Questions
  if (config.shuffleQuestions) {
    selected = shuffleArray(selected);
  }

  // 5. Shuffle Options
  if (config.shuffleOptions) {
    selected = selected.map(shuffleQuestionOptions);
  }

  // Update question numbers sequentially
  return selected.map((q, idx) => ({
    ...q,
    number: idx + 1,
  }));
}

/**
 * Smart Random using Gemini AI to pick best balanced questions
 */
export async function smartRandomSelect(
  questions: QuizQuestion[],
  targetCount: number
): Promise<QuizQuestion[]> {
  if (questions.length <= targetCount) {
    return questions;
  }

  const prompt = `
You are a Smart Quiz Balancer. From the list of ${questions.length} questions below, select EXACTLY ${targetCount} best quality questions.

REQUIREMENTS:
1. Remove duplicates or near-duplicate questions.
2. Balance topics evenly.
3. Balance difficulty levels (easy, medium, hard).
4. Avoid repetitive wording or trivial questions.
5. Return ONLY a JSON array of the selected question IDs: ["q_1", "q_4", "q_7"...]

QUESTIONS LIST:
${JSON.stringify(
  questions.map((q) => ({ id: q.id, text: q.text })),
  null,
  2
)}
`;

  try {
    const outputText = await runQuizModelChain([
      { role: "user", parts: [{ text: prompt }] },
    ]);

    const cleanText = outputText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleanText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const selectedIds: string[] = JSON.parse(jsonMatch[0]);
      const selectedSet = new Set(selectedIds);
      const smartSelected = questions.filter((q) => selectedSet.has(q.id));
      if (smartSelected.length >= Math.min(targetCount, 5)) {
        return smartSelected.slice(0, targetCount);
      }
    }
  } catch (err) {
    console.error("smartRandomSelect error:", err);
  }

  return shuffleArray(questions).slice(0, targetCount);
}

/**
 * Quiz Splitter
 * Example: 130 questions with batch size 50 -> returns [50, 50, 30] batches
 */
export function splitQuizIntoBatches(
  questions: QuizQuestion[],
  batchSize: number
): QuizQuestion[][] {
  if (!batchSize || batchSize <= 0 || batchSize >= questions.length) {
    return [questions];
  }

  const batches: QuizQuestion[][] = [];
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize).map((q, idx) => ({
      ...q,
      number: idx + 1,
    }));
    batches.push(batch);
  }

  return batches;
}
