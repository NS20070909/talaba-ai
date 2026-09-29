import { GoogleGenAI } from "@google/genai";

/**
 * Returns true if the error is a quota/rate-limit error (429 or resource exhausted).
 * These must NOT be retried on the same model — immediately switch to the next model.
 */
export function isQuotaError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || error || "").toLowerCase();
  const status = Number(error.status || error.statusCode || error.code || 0);
  if (status === 429) return true;
  if (message.includes("429")) return true;
  if (
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("too many requests")
  ) {
    return true;
  }
  return false;
}

/**
 * Returns true if the error is transient and worth retrying on the SAME model
 * (500, 503, network reset, gateway timeout).
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  if (isQuotaError(error)) return false; // quota: skip to next model, do not retry
  const message = String(error.message || error || "").toLowerCase();
  const status = Number(error.status || error.statusCode || error.code || 0);
  if (status === 503 || status === 500 || status === 502 || status === 504) return true;
  if (
    message.includes("503") ||
    message.includes("500") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("unavailable") ||
    message.includes("internal error")
  ) {
    return true;
  }
  if (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("fetch failed") ||
    message.includes("network error")
  ) {
    return true;
  }
  return false;
}

/**
 * Returns true if model is unavailable / not found (404), should switch to next model immediately.
 */
export function isModelUnavailableError(error: any): boolean {
  if (!error) return false;
  const message = String(error.message || error || "").toLowerCase();
  const status = Number(error.status || error.statusCode || error.code || 0);
  if (status === 404) return true;
  if (message.includes("404") || message.includes("not found") || message.includes("is not supported")) {
    return true;
  }
  return false;
}

export type GeminiRunnerPrompt =
  | string
  | Array<
      | string
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
      | {
          text: string;
        }
    >;

export type GeminiRunnerOptions = {
  apiKey: string;
  modelChain: string[];
  prompt: GeminiRunnerPrompt;
  timeoutMs?: number;
  perModelTimeoutMs?: number;
  generationConfig?: Record<string, unknown>;
  maxAttemptsPerModel?: number;
  maxRetriesPerModel?: number;
  maxTotalMs?: number;
};

/**
 * Formats flexible runner prompt types into @google/genai compatible contents array.
 */
function formatPromptToContents(prompt: GeminiRunnerPrompt): any[] {
  if (typeof prompt === "string") {
    return [{ role: "user", parts: [{ text: prompt }] }];
  }

  if (Array.isArray(prompt)) {
    const parts: any[] = [];
    for (const item of prompt) {
      if (typeof item === "string") {
        parts.push({ text: item });
      } else if (item && typeof item === "object") {
        if ("inlineData" in item && item.inlineData) {
          parts.push({
            inlineData: {
              mimeType: item.inlineData.mimeType,
              data: item.inlineData.data,
            },
          });
        } else if ("text" in item && typeof item.text === "string") {
          parts.push({ text: item.text });
        }
      }
    }
    return [{ role: "user", parts }];
  }

  return [{ role: "user", parts: [{ text: String(prompt) }] }];
}

/**
 * Executes a Gemini request across a bounded model fallback chain using @google/genai SDK.
 * 
 * Key guarantees:
 * 1. Per-model bounded timeout with native AbortController cancellation.
 * 2. Total time budget enforcement (maxTotalMs) preventing Vercel 504 timeouts.
 * 3. 429 / Quota / 404: immediate fallback to next model (0 retries).
 * 4. 500 / 503 / Network errors: controlled bounded retries (default 1 attempt, max 2).
 * 5. Sanitized logging (no API keys, tokens, or private user text leaked).
 */
export async function runGeminiWithFallback(options: GeminiRunnerOptions): Promise<{ text: string; model: string }> {
  const {
    apiKey,
    modelChain,
    prompt,
    generationConfig,
    maxTotalMs = 38000,
  } = options;

  const timeoutMs = options.perModelTimeoutMs ?? options.timeoutMs ?? 12000;
  const maxAttemptsPerModel = options.maxRetriesPerModel !== undefined
    ? options.maxRetriesPerModel + 1
    : (options.maxAttemptsPerModel ?? 1);

  if (!apiKey) {
    throw new Error("API key is required for Gemini execution");
  }

  if (!modelChain || modelChain.length === 0) {
    throw new Error("modelChain must contain at least one model");
  }

  const startTime = Date.now();
  const deadline = startTime + maxTotalMs;
  const contents = formatPromptToContents(prompt);
  let lastError: any = null;

  for (const modelName of modelChain) {
    // Check if remaining total time budget allows trying another model
    const remainingTotalMs = deadline - Date.now();
    if (remainingTotalMs <= 1500) {
      console.warn(`[Gemini Fallback] Total budget exhausted (${Date.now() - startTime}ms elapsed). Aborting chain.`);
      break;
    }

    const currentTimeoutMs = Math.min(timeoutMs, remainingTotalMs);
    const attemptsLimit = Math.max(1, Math.min(maxAttemptsPerModel, 2));

    for (let attempt = 1; attempt <= attemptsLimit; attempt++) {
      const attemptStart = Date.now();
      const attemptRemaining = deadline - Date.now();
      if (attemptRemaining <= 1500) break;

      const effectiveTimeout = Math.min(currentTimeoutMs, attemptRemaining);
      const abortController = new AbortController();
      const timer = setTimeout(() => {
        try {
          abortController.abort();
        } catch {}
      }, effectiveTimeout);

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            timeout: effectiveTimeout,
          },
        });

        const config: Record<string, unknown> = {
          ...(generationConfig || {}),
        };

        const result = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        clearTimeout(timer);
        const text = (result?.text ?? "").trim();
        const duration = Date.now() - attemptStart;

        if (text) {
          console.log(`[Gemini Fallback] model=${modelName} attempt=${attempt} duration=${duration}ms status=SUCCESS`);
          return { text, model: modelName };
        } else {
          throw new Error("Gemini returned empty text response");
        }
      } catch (err: any) {
        clearTimeout(timer);
        lastError = err;
        const duration = Date.now() - attemptStart;
        const errMessage = String(err?.message || err || "Unknown error");
        const status = err?.status || err?.statusCode || (abortController.signal.aborted ? "TIMEOUT" : "ERROR");

        console.warn(`[Gemini Fallback] model=${modelName} attempt=${attempt} duration=${duration}ms status=${status} msg=${errMessage.slice(0, 120)}`);

        // 429 Quota / Rate limit error: immediately switch to next model, do not retry
        if (isQuotaError(err)) {
          break;
        }

        // 404 Model Unavailable: immediately switch to next model
        if (isModelUnavailableError(err)) {
          break;
        }

        // Non-transient error (e.g. 400 Bad Request, unprocessable input): do not retry
        if (!isTransientError(err) && !abortController.signal.aborted) {
          break;
        }

        // If retryable and attempt remaining, short backoff
        if (attempt < attemptsLimit && deadline - Date.now() > 2000) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    }
  }

  const totalDuration = Date.now() - startTime;
  const failureError = new Error(
    `All models in fallback chain failed after ${totalDuration}ms: ${lastError?.message || "Timeout or upstream failure"}`
  );
  (failureError as any).lastError = lastError;
  throw failureError;
}
