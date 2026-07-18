import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_MODEL_CHAIN } from "./constants";
import type { AiAnalysisResult, DocumentScores, HeadingInfo } from "./types";

function cleanJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

const DEFAULT_SCORES: DocumentScores = {
  overall: 60,
  formatting: 60,
  consistency: 60,
  structure: 60,
  readability: 60,
  academic: 60,
};

function normalizeAnalysis(raw: Partial<AiAnalysisResult>): AiAnalysisResult {
  return {
    documentScore: typeof raw.documentScore === "number" ? raw.documentScore : 60,
    issues: Array.isArray(raw.issues) ? raw.issues.slice(0, 20) : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations.slice(0, 15) : [],
    headings: Array.isArray(raw.headings) ? raw.headings.slice(0, 40) : [],
    paragraphFixes: Array.isArray(raw.paragraphFixes) ? raw.paragraphFixes.slice(0, 60) : [],
    grammar: Array.isArray(raw.grammar) ? raw.grammar.slice(0, 30) : [],
    duplicates: Array.isArray(raw.duplicates) ? raw.duplicates.slice(0, 15) : [],
    formatting: Array.isArray(raw.formatting) ? raw.formatting.slice(0, 20) : [],
    tables: Array.isArray(raw.tables) ? raw.tables.slice(0, 10) : [],
    images: Array.isArray(raw.images) ? raw.images.slice(0, 10) : [],
    scores: raw.scores && typeof raw.scores === "object" ? { ...DEFAULT_SCORES, ...raw.scores } : DEFAULT_SCORES,
  };
}

function buildPrompt(payload: string): string {
  return `You are an academic document quality analyzer for university students in Uzbekistan.
Analyze the document structure and return ONLY valid JSON (no markdown, no explanation).

Rules:
- Never rewrite or invent content
- Never generate full document text
- Detect headings, grammar issues, duplicates, formatting problems
- Support Uzbek, English, and Russian text
- Grammar suggestions must NOT change meaning — only suggest corrections
- Identify academic sections: title, abstract, introduction, chapter, conclusion, references, appendix

Return this exact JSON structure:
{
  "documentScore": number (0-100),
  "issues": string[],
  "recommendations": string[],
  "headings": [{"paragraphIndex": number, "text": string, "level": "title"|"heading1"|"heading2"|"heading3"|"section", "academicRole": "title"|"abstract"|"introduction"|"chapter"|"section"|"conclusion"|"references"|"appendix"|"other"}],
  "paragraphFixes": [{"paragraphIndex": number, "fixes": string[]}],
  "grammar": [{"paragraphIndex": number, "original": string, "suggestion": string, "reason": string, "language": "uz"|"en"|"ru"|"unknown"}],
  "duplicates": [{"paragraphIndex": number, "text": string, "duplicateOfIndex": number}],
  "formatting": string[],
  "tables": string[],
  "images": string[],
  "scores": {"overall": number, "formatting": number, "consistency": number, "structure": number, "readability": number, "academic": number}
}

Document data:
${payload}`;
}

async function callGeminiOnce(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string
): Promise<AiAnalysisResult> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(cleanJson(text)) as Partial<AiAnalysisResult>;
  return normalizeAnalysis(parsed);
}

export async function analyzeDocumentWithGemini(
  payload: string
): Promise<{ analysis: AiAnalysisResult; model: string; durationMs: number }> {
  const apiKey = process.env.REFERAT_Tozalash_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AI xizmati vaqtincha mavjud emas. Keyinroq urinib ko'ring");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildPrompt(payload);
  const start = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const modelName of GEMINI_MODEL_CHAIN) {
      try {
        const analysis = await callGeminiOnce(genAI, modelName, prompt);
        return { analysis, model: modelName, durationMs: Date.now() - start };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw lastError || new Error("AI tahlil vaqtincha mavjud emas. Keyinroq urinib ko'ring");
}

export function getHeadingMap(headings: HeadingInfo[]): Map<number, HeadingInfo> {
  const map = new Map<number, HeadingInfo>();
  for (const h of headings) {
    map.set(h.paragraphIndex, h);
  }
  return map;
}
