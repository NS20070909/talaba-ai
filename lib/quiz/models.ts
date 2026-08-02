import { GoogleGenAI } from "@google/genai";

// Standard production Gemini models in order of priority & speed
export const QUIZ_MODEL_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash-lite",
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
 * For ALL other errors (404, 429, 500, 502, 503, 504, TIMEOUT, etc.), returns false
 * so the chain continues immediately to the next model.
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
 * Runs the model chain with a strict per-model timeout (default 12s) to prevent
 * Vercel 504 Function Invocation Timeout errors.
 */
export async function runQuizModelChain(
  contents: any,
  timeoutMsPerModel: number = 12000
): Promise<string> {
  const apiKey = getQuizApiKey();
  const ai = new GoogleGenAI({ apiKey });
  let lastError: any = null;

  for (const model of QUIZ_MODEL_CHAIN) {
    const startTime = Date.now();
    const cleanModel = model.replace(/^models\//, "");

    try {
      // Per-model timeout race promise to prevent Vercel 504 timeout
      const generatePromise = ai.models.generateContent({
        model: cleanModel,
        contents,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Timeout (${timeoutMsPerModel}ms) exceeded for model ${model}`));
        }, timeoutMsPerModel);
        // Ensure timer unref if supported in node environment
        if (timer && typeof timer === "object" && "unref" in timer) {
          (timer as any).unref();
        }
      });

      const response: any = await Promise.race([generatePromise, timeoutPromise]);
      const elapsed = Date.now() - startTime;

      const text = response?.text ? response.text.trim() : "";
      if (text.length > 0) {
        console.log(`[Quiz Model Chain Success] Model: '${model}' | Elapsed: ${elapsed}ms | Output length: ${text.length} chars`);
        return text;
      }
    } catch (err: any) {
      const elapsed = Date.now() - startTime;
      lastError = err;

      const status = err?.status || err?.statusCode || err?.response?.status || "N/A";
      const message = err?.message || String(err);

      console.warn(
        `[Quiz Model Chain Warning] Model: '${model}' failed after ${elapsed}ms | Status: ${status} | Error: ${message}`
      );

      if (isNonRetryableQuizError(err)) {
        console.error(`[Quiz Model Chain Fatal] Non-retryable auth/config error on '${model}': ${message}`);
        throw err;
      }
      // Non-configuration error -> continue immediately to next model in QUIZ_MODEL_CHAIN
    }
  }

  console.error("[Quiz Model Chain Fatal] All models in QUIZ_MODEL_CHAIN failed or timed out.");
  throw lastError || new Error("All models in QUIZ_MODEL_CHAIN failed or timed out.");
}
