import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Checks if an error is a transient error suitable for retrying (Rate Limit 429, Service Unavailable 503, Timeout, Network Error).
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  const message = (error.message || "").toLowerCase();
  const status = error.status || error.statusCode;

  if (status === 429 || status === 503) return true;
  if (message.includes("429") || message.includes("503")) return true;
  if (message.includes("quota") || message.includes("rate limit") || message.includes("resource_exhausted")) return true;
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
 * Switches models only on the same API key if a model attempt fails.
 */
export async function runGeminiWithFallback({
  apiKey,
  modelChain,
  prompt,
  timeoutMs = 30000,
  generationConfig,
}: GeminiRunnerOptions): Promise<{ text: string; model: string }> {
  if (!apiKey) {
    throw new Error("API key is required for Gemini execution");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;

  for (const modelName of modelChain) {
    console.log(`[Gemini Fallback] Trying model: ${modelName}`);

    // Retry loop for transient errors per model (max 2 attempts per model)
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

        // If it's not a transient error (e.g. invalid prompt/400 bad request), break retry loop and try next model
        if (!isTransientError(err)) {
          break;
        }

        if (attempt < 2) {
          // Wait 500ms before retrying the same model
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }
  }

  throw lastError || new Error("All Gemini models in fallback chain failed.");
}
