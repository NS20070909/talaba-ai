import { QuizQuestion, QuizConfig } from "./types";
import { runQuizModelChain } from "./models";

export interface AutoBuilderRecommendation {
  quizTitle: string;
  recommendedConfig: QuizConfig;
  reasoning: string;
}

export async function recommendQuizConfig(
  questions: QuizQuestion[],
  sourceFileName?: string
): Promise<AutoBuilderRecommendation> {
  const totalCount = questions.length;

  const fallbackTitle = sourceFileName
    ? sourceFileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    : "Academic Quiz";

  const defaultConfig: QuizConfig = {
    title: fallbackTitle,
    selectionMode: totalCount > 40 ? "SMART_RANDOM" : "ALL",
    targetCount: totalCount > 40 ? 30 : totalCount,
    shuffleQuestions: true,
    shuffleOptions: true,
    timerSeconds: 30,
    splitBatchSize: totalCount > 60 ? 50 : undefined,
  };

  if (totalCount === 0) {
    return {
      quizTitle: fallbackTitle,
      recommendedConfig: defaultConfig,
      reasoning: "Manba matni va savollar soniga asoslangan avtomatik tavsiya.",
    };
  }

  const prompt = `
Analyze this quiz dataset (${totalCount} total questions, source filename: "${sourceFileName || "Quiz"}") and recommend optimal quiz configuration settings.

Return ONLY a JSON object matching this schema:
{
  "quizTitle": "Catchy academic quiz title in Uzbek",
  "targetCount": 25,
  "selectionMode": "SMART_RANDOM",
  "shuffleQuestions": true,
  "shuffleOptions": true,
  "timerSeconds": 30,
  "splitBatchSize": 50,
  "reasoning": "Uzbek explanation of why these parameters fit best"
}

Sample Questions:
${JSON.stringify(
  questions.slice(0, 5).map((q) => q.text),
  null,
  2
)}
`;

  try {
    const textOutput = await runQuizModelChain([
      { role: "user", parts: [{ text: prompt }] },
    ]);

    const cleanText = textOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const rec = JSON.parse(jsonMatch[0]);
      return {
        quizTitle: rec.quizTitle || fallbackTitle,
        recommendedConfig: {
          title: rec.quizTitle || fallbackTitle,
          selectionMode: rec.selectionMode || "SMART_RANDOM",
          targetCount: rec.targetCount || (totalCount > 40 ? 30 : totalCount),
          shuffleQuestions: rec.shuffleQuestions ?? true,
          shuffleOptions: rec.shuffleOptions ?? true,
          timerSeconds: rec.timerSeconds || 30,
          splitBatchSize: rec.splitBatchSize || (totalCount > 60 ? 50 : undefined),
        },
        reasoning: rec.reasoning || "AI tomonidan tavsiya etilgan optimal konfiguratsiya.",
      };
    }
  } catch (err) {
    console.error("recommendQuizConfig error:", err);
  }

  return {
    quizTitle: fallbackTitle,
    recommendedConfig: defaultConfig,
    reasoning: "Manba matniga asoslangan standart tavsiya.",
  };
}
