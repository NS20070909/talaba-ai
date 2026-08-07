import { QuizQuestion, QuizConfig, QuizCollection, QuizTestSet } from "./types";
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

export function splitQuizIntoBatches<T>(items: T[], batchSize: number): T[][] {
  if (!batchSize || batchSize <= 0) return [items];
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Multi-Test Collection Builder: Splits total questions into sequential, non-overlapping test sets.
 * Shuffles questions/options strictly inside each batch if configured.
 */
export function buildQuizCollection(
  questions: QuizQuestion[],
  config: QuizConfig
): QuizCollection {
  const total = questions.length;
  const batchSize = Math.max(1, config.multiTestBatchSize || 25);
  const testSets: QuizTestSet[] = [];
  const mainTitle = config.title || "Yangi Test";

  let index = 1;
  for (let i = 0; i < total; i += batchSize) {
    const slice = questions.slice(i, i + batchSize);
    const startNum = i + 1;
    const endNum = i + slice.length;

    let batchQuestions = [...slice];
    if (config.shuffleQuestions) {
      batchQuestions = shuffleArray(batchQuestions);
    }
    if (config.shuffleOptions) {
      batchQuestions = batchQuestions.map(shuffleQuestionOptions);
    }

    testSets.push({
      id: `set_${index}_${Math.random().toString(36).substring(2, 7)}`,
      index,
      title: `Test ${index} (${startNum}–${endNum})`,
      startNum,
      endNum,
      questions: batchQuestions,
    });
    index++;
  }

  return {
    title: mainTitle,
    totalQuestions: total,
    batchSize,
    testSets,
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
  }

  // 4. Target Count Limit (Slice to requested targetCount if smaller than total)
  if (config.targetCount && config.targetCount > 0 && config.targetCount < selected.length) {
    selected = selected.slice(0, config.targetCount);
  }

  // 5. Shuffle Questions
  if (config.shuffleQuestions) {
    selected = shuffleArray(selected);
  }

  // 6. Shuffle Options
  if (config.shuffleOptions) {
    selected = selected.map(shuffleQuestionOptions);
  }

  return selected;
}

/**
 * Smart Random AI Selection: picks the most diverse and high-quality subset of questions
 */
export async function smartRandomSelect(
  questions: QuizQuestion[],
  targetCount: number
): Promise<QuizQuestion[]> {
  if (questions.length <= targetCount) return questions;

  const prompt = `
Task: Select exactly ${targetCount} best, non-duplicate, highly representative test questions from the list below.
Return a JSON array of selected Question IDs only: ["q_1", "q_2", ...].

QUESTIONS:
${JSON.stringify(
  questions.map((q) => ({ id: q.id, question: q.text })),
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
      const ids: string[] = JSON.parse(jsonMatch[0]);
      const idSet = new Set(ids);
      const selected = questions.filter((q) => idSet.has(q.id));
      if (selected.length > 0) return selected;
    }
  } catch (err) {
    console.error("smartRandomSelect error, falling back to random shuffle:", err);
  }

  return shuffleArray(questions).slice(0, targetCount);
}
