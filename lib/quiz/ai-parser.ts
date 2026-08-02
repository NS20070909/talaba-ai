import { QuizQuestion } from "./types";
import { runQuizModelChain } from "./models";

export async function parseQuizWithAi(unparsedText: string): Promise<QuizQuestion[]> {
  const prompt = `
You are an expert AI Quiz Parser for university and academic tests (Uzbek, Russian, English).
Your task is to parse messy, unstructured, OCR-scanned, or complex test material into structured JSON format.

RULES:
1. Extract every single question and its options (A, B, C, D or 1, 2, 3, 4).
2. Identify the correct answer option for each question if indicated (+ marker, *, bold, underline, or answer key at the bottom).
3. If an answer key is provided at the bottom (e.g. 1-A, 2-B, 3-C), apply it accurately to questions.
4. Clean up broken OCR characters or formatting glitches while preserving exact meaning.
5. Return ONLY a valid JSON array of objects with the following schema:
[
  {
    "number": 1,
    "text": "Question text here",
    "options": [
      { "id": "A", "text": "Option A text", "isCorrect": true },
      { "id": "B", "text": "Option B text", "isCorrect": false },
      { "id": "C", "text": "Option C text", "isCorrect": false },
      { "id": "D", "text": "Option D text", "isCorrect": false }
    ],
    "correctOptionId": "A"
  }
]

RAW TEST TEXT:
${unparsedText.substring(0, 20000)}
`;

  try {
    const textOutput = await runQuizModelChain([
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ]);

    const cleanText = textOutput.replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);

    if (jsonMatch) {
      const parsedArray = JSON.parse(jsonMatch[0]);
      return parsedArray.map((q: any, idx: number) => ({
        id: `q_ai_${idx + 1}_${Math.random().toString(36).substring(2, 7)}`,
        number: q.number || idx + 1,
        text: q.text || `Question ${idx + 1}`,
        options: (q.options || []).map((o: any) => ({
          id: String(o.id || "A").toUpperCase(),
          text: String(o.text || "").trim(),
          isCorrect: Boolean(o.isCorrect),
        })),
        correctOptionId: q.correctOptionId || (q.options?.find((o: any) => o.isCorrect)?.id),
        isAiParsed: true,
      }));
    }
  } catch (error) {
    console.error("parseQuizWithAi error:", error);
  }

  return [];
}
