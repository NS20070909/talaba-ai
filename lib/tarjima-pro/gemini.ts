import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenAI } from "@google/genai";
import {
  ACADEMIC_MODEL_CHAIN,
  FAST_MODEL_CHAIN,
  LANG_LABELS,
  STANDARD_MODEL_CHAIN,
} from "./constants";
import type { LangCode, TranslationMode } from "./types";

function getApiKey(): string {
  const key = process.env.Tarjima_pro_GEMINI_API;
  if (!key) {
    throw new Error("AI xizmati vaqtincha mavjud emas. Keyinroq urinib ko'ring");
  }
  return key;
}

function cleanJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return cleaned.trim();
}

export function selectModelChain(options: {
  mode: TranslationMode;
  academic: boolean;
  isPremium: boolean;
  textLength: number;
}): string[] {
  if (options.academic && options.isPremium) {
    return ACADEMIC_MODEL_CHAIN;
  }
  if (options.mode === "text" && options.textLength < 2500) {
    return FAST_MODEL_CHAIN;
  }
  if (options.isPremium) {
    return ACADEMIC_MODEL_CHAIN;
  }
  return STANDARD_MODEL_CHAIN;
}

function buildTranslationPrompt(
  items: { index: number; text: string }[],
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean
): string {
  const style = academic
    ? "Use formal academic register suitable for university papers, theses, and scientific articles. Preserve citations, terminology, and structural markers."
    : "Use natural, professional language. Preserve meaning and tone.";

  return `You are an expert translator (${LANG_LABELS[sourceLang]} → ${LANG_LABELS[targetLang]}).
Translate each item accurately. Return ONLY valid JSON (no markdown):
{"translations":[{"index":number,"text":"translated text"},...]}

Rules:
- ${style}
- Do NOT add, remove, or summarize content
- Preserve numbers, dates, names, and references appropriately
- Keep paragraph structure — one output per input index
- If text is already in target language, polish it professionally

Input:
${JSON.stringify({ items, sourceLang, targetLang })}`;
}

function buildTextPrompt(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean
): string {
  const style = academic
    ? "Use formal academic register for university and scientific documents."
    : "Use natural professional language.";

  return `Translate the following text from ${LANG_LABELS[sourceLang]} to ${LANG_LABELS[targetLang]}.
${style}
Return ONLY the translated text — no explanations, no markdown fences.

Text:
${text}`;
}

async function callTranslateBatch(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string
): Promise<{ index: number; text: string }[]> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(cleanJson(result.response.text())) as {
    translations?: { index: number; text: string }[];
  };

  if (!Array.isArray(parsed.translations)) {
    throw new Error("AI javobi noto'g'ri formatda");
  }

  return parsed.translations;
}

async function callTranslateText(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 8192,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function translateParagraphs(
  items: { index: number; text: string }[],
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean,
  modelChain: string[]
): Promise<{ translations: Map<number, string>; model: string }> {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildTranslationPrompt(items, sourceLang, targetLang, academic);
  let lastError: Error | null = null;

  for (const modelName of modelChain) {
    try {
      const results = await callTranslateBatch(genAI, modelName, prompt);
      const map = new Map<number, string>();
      for (const item of results) {
        if (typeof item.index === "number" && typeof item.text === "string") {
          map.set(item.index, item.text);
        }
      }
      for (const item of items) {
        if (!map.has(item.index)) {
          map.set(item.index, item.text);
        }
      }
      return { translations: map, model: modelName };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("Tarjima vaqtincha mavjud emas. Keyinroq urinib ko'ring");
}

export async function translatePlainText(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean,
  modelChain: string[]
): Promise<{ text: string; model: string }> {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = buildTextPrompt(text, sourceLang, targetLang, academic);
  let lastError: Error | null = null;

  for (const modelName of modelChain) {
    try {
      const translated = await callTranslateText(genAI, modelName, prompt);
      return { text: translated, model: modelName };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("Tarjima vaqtincha mavjud emas. Keyinroq urinib ko'ring");
}

export async function extractPdfTextWithOcr(pdfBuffer: Buffer): Promise<string> {
  const apiKey = getApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const base64 = pdfBuffer.toString("base64");
  const models = STANDARD_MODEL_CHAIN;
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Extract ALL text from this PDF document using OCR if needed. Preserve paragraph breaks with double newlines. Do not summarize. Return only the extracted text.",
              },
              {
                inlineData: {
                  mimeType: "application/pdf",
                  data: base64,
                },
              },
            ],
          },
        ],
      });

      const text = result.text || "";
      if (text.trim().length > 20) return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error("PDF matnini o'qib bo'lmadi");
}
