import { GoogleGenAI } from "@google/genai";

export const QUIZ_MODEL_CHAIN = [
  "models/gemini-2.5-flash",
  "models/gemini-3.6-flash",
  "models/gemini-3.5-flash",
  "models/gemini-2.5-flash-lite",
  "models/gemini-3.5-flash-lite",
  "models/gemini-2.0-flash",
  "models/gemini-2.0-flash-001",
  "models/gemini-2.0-flash-lite",
  "models/gemini-2.0-flash-lite-001",
  "models/gemini-2.5-pro",
];

export type QuizModelName = (typeof QUIZ_MODEL_CHAIN)[number];

export function getQuizApiKey(): string {
  const key = process.env.GEMINI_QUIZ_API_KEY;
  if (!key) {
    throw new Error("GEMINI_QUIZ_API_KEY is not configured in environment variables.");
  }
  return key;
}

/**
 * Returns true ONLY for non-retryable configuration/auth errors (400, 401, 403, API_KEY_INVALID, INVALID_ARGUMENT).
 * For ALL other errors (404, 429, 500, 502, 503, 504, RESOURCE_EXHAUSTED, TIMEOUT, UNAVAILABLE, etc.), returns false
 * so the chain continues to the next model.
 */
export function isNonRetryableQuizError(error: any): boolean {
  if (!error) return false;

  const status = Number(error.status || error.statusCode || error.response?.status || 0);
  const message = String(error.message || error || "").toUpperCase();

  // Explicit configuration/auth HTTP statuses
  if (status === 400 || status === 401 || status === 403) {
    return true;
  }

  // Explicit configuration/auth error text markers
  if (
    message.includes("400 INVALID") ||
    message.includes("INVALID_ARGUMENT") ||
    message.includes("401 UNAUTHORIZED") ||
    message.includes("API_KEY_INVALID") ||
    message.includes("403 FORBIDDEN") ||
    message.includes("PERMISSION_DENIED")
  ) {
    return true;
  }

  return false;
}

export async function runQuizModelChain(contents: any): Promise<string> {
  const apiKey = getQuizApiKey();
  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  for (const model of QUIZ_MODEL_CHAIN) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
      });

      const text = response.text ? response.text.trim() : "";
      if (text.length > 0) {
        return text;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`Model failed:\n${model}\nReason:\n${err?.message || err}`);

      if (isNonRetryableQuizError(err)) {
        throw err;
      }
      // Non-configuration error -> continue automatically to next model in QUIZ_MODEL_CHAIN
    }
  }

  console.error("All models failed.");
  throw lastError || new Error("All models in QUIZ_MODEL_CHAIN failed.");
}
