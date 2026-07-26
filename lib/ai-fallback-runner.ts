import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Returns true if the error is a quota/rate-limit error (429).
 * These should NOT be retried — switch to the next model immediately.
 */
export function isQuotaError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  const status = error.status || error.statusCode;
  if (status === 429) return true;
  if (message.includes("429")) return true;
  if (message.includes("quota") || message.includes("rate limit") || message.includes("resource_exhausted")) return true;
  return false;
}

/**
 * Returns true if the error is a transient error worth retrying on the SAME model
 * (timeout, network reset, 500/503 server errors).
 * 429 / quota errors are NOT retryable — they need a model switch, not a retry.
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  if (isQuotaError(error)) return false; // quota: skip to next model, don't retry
  const message = (error.message || "").toLowerCase();
  const status = error.status || error.statusCode;
  if (status === 503 || status === 500) return true;
  if (message.includes("503") || message.includes("500")) return true;
  if (message.includes("timeout") || message.includes("econnreset") || message.includes("etimedout") || message.includes("fetch failed")) return true;
  return false;
}

export type GeminiRunnerOptions = {
  apiKey: string;
  modelChain: string[];
  prompt: string | (string | { inlineData: { mimeType: string; data: string } })[];
  timeoutMs?: number;
  generationConfig?: any;
};

/**
 * Executes a Gemini prompt across a model fallback chain using a single dedicated API Key.
 * - 429 / quota errors: immediately skip to next model (no retry, no delay)
 * - timeout / network / 500: retry once on the same model, then move to next
 * - Per-model timeout: 22s (keeps total under Vercel's 60s limit across 3 models)
 */
export async function runGeminiWithFallback({
  apiKey,
  modelChain,
  prompt,
  timeoutMs = 22000,
  generationConfig,
}: GeminiRunnerOptions): Promise<{ text: string; model: string }> {
  if (!apiKey) {
    throw new Error("API key is required for Gemini execution");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;

  for (const modelName of modelChain) {
    console.log(`[Gemini Fallback] Trying model: ${modelName}`);

    // Max 2 attempts per model, but ONLY for retryable (non-quota) errors
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig,
        });

        const contentPromise = model.generateContent(prompt as any);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
        );

        const result: any = await Promise.race([contentPromise, timeoutPromise]);
        const text = result.response.text();

        if (text) {
          console.log(`[Gemini Fallback] Success with model: ${modelName}`);
          return { text, model: modelName };
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Fallback] Model ${modelName} attempt ${attempt} failed: ${err?.message || err}`);

        // 429 / quota error: skip to next model immediately, no retry
        if (isQuotaError(err)) {
          console.warn(`[Gemini Fallback] Quota/rate-limit on ${modelName}, switching to next model.`);
          break;
        }

        // Non-retryable error (bad prompt, 400, etc.): also break to next model
        if (!isTransientError(err)) {
          break;
        }

        // Retryable (timeout/network/500): wait briefly before retry
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
    }
  }

  throw lastError || new Error("All Gemini models in fallback chain failed.");
}
