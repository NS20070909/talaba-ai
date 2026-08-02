import { GoogleGenAI } from "@google/genai";

// Verified production Gemini models in strict priority order
export const QUIZ_MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-2.5-pro",
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
 * For ALL other errors (404, 429, 500, 502, 503, 504, RESOURCE_EXHAUSTED, TIMEOUT, etc.), returns false
 * so the sequential fallback continues immediately to the next model.
 */
export function isNonRetryableQuizError(error: any): boolean {
  if (!error) return false;

  const status = Number(error.status || error.statusCode || error.response?.status || 0);
  const message = String(error.message || error || "").toUpperCase();

  if (status === 400 || status === 401 || status === 403) {
    return true;
  }

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

/**
 * Sequential fallback engine with strict per-model timeout (8s max per model) to prevent
 * Vercel 504 Function Invocation Timeout errors.
 */
export async function runQuizModelChain(
  contents: any,
  timeoutMsPerModel: number = 8000
): Promise<string> {
  const apiKey = getQuizApiKey();
  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;
  const blacklistedModels = new Set<string>();

  for (let i = 0; i < QUIZ_MODEL_CHAIN.length; i++) {
    const model = QUIZ_MODEL_CHAIN[i];
    if (blacklistedModels.has(model)) continue;

    const cleanModel = model.replace(/^models\//, "");
    console.log(`[Quiz Model] Trying: ${model}`);

    try {
      const generatePromise = ai.models.generateContent({
        model: cleanModel,
        contents,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout (${timeoutMsPerModel}ms)`));
        }, timeoutMsPerModel);
        if (timer && typeof timer === "object" && "unref" in timer) {
          (timer as any).unref();
        }
      });

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const text = response?.text ? response.text.trim() : "";

      if (text.length > 0) {
        console.log(`[Quiz Model] Success (${model})`);
        return text;
      }
    } catch (err: any) {
      lastError = err;
      const status = Number(err?.status || err?.statusCode || err?.response?.status || 0);
      const message = String(err?.message || err || "");

      if (status === 404 || message.includes("404") || message.includes("NOT_FOUND")) {
        console.warn(`[Quiz Model] Failed (404)`);
        blacklistedModels.add(model);
      } else if (status === 429 || message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
        console.warn(`[Quiz Model] Failed (429 Rate Limit / Quota Exceeded)`);
      } else {
        console.warn(`[Quiz Model] Failed (${status || "Error"})`);
      }

      if (isNonRetryableQuizError(err)) {
        console.error(`[Quiz Model] Non-retryable error: ${message}`);
        throw err;
      }

      const nextModel = QUIZ_MODEL_CHAIN[i + 1];
      if (nextModel) {
        console.log(`[Quiz Model] Fallback → ${nextModel}`);
      }
    }
  }

  console.error("[Quiz Model] All models in QUIZ_MODEL_CHAIN failed or timed out.");
  throw lastError || new Error("All models in QUIZ_MODEL_CHAIN failed or timed out.");
}
