import type { PlanType } from "@/lib/user";
import { getDocumentLimits, STAGE_MESSAGES } from "./constants";
import { analyzeDocumentWithGemini } from "./gemini";
import { formatCleanedDocument } from "./formatter";
import { buildAnalysisPayload, parseDocx } from "./parser";
import { calculateAfterScores, calculateDocumentScores } from "./scorer";
import type {
  CleanDocumentResult,
  ProgressCallback,
  ProgressUpdate,
} from "./types";
import { validateDocxBuffer, validateFileMeta } from "./validator";

function emit(callback: ProgressCallback | undefined, update: ProgressUpdate): void {
  callback?.({
    ...update,
    message: update.message || STAGE_MESSAGES[update.stage] || update.stage,
  });
}

export async function cleanDocument(
  inputBuffer: Buffer,
  fileName: string,
  mimeType: string | undefined,
  plan: PlanType,
  onProgress?: ProgressCallback
): Promise<CleanDocumentResult> {
  const startTime = Date.now();
  const limits = getDocumentLimits(plan);

  emit(onProgress, { stage: "validating", progress: 5, message: STAGE_MESSAGES.validating });

  const metaCheck = validateFileMeta(fileName, inputBuffer.length, mimeType, limits);
  if (!metaCheck.valid) {
    throw new Error(metaCheck.error || "Hujjat tekshiruvdan o'tmadi");
  }

  emit(onProgress, { stage: "reading", progress: 12, message: STAGE_MESSAGES.reading });

  const parsed = await parseDocx(inputBuffer);

  const bufferCheck = validateDocxBuffer(
    inputBuffer,
    limits,
    parsed.pageCount,
    parsed.rawText.trim().length
  );
  if (!bufferCheck.valid) {
    throw new Error(bufferCheck.error || "Hujjat tekshiruvdan o'tmadi");
  }

  emit(onProgress, { stage: "analyzing", progress: 22, message: STAGE_MESSAGES.analyzing });

  const beforeScore = calculateDocumentScores(parsed);

  emit(onProgress, { stage: "checking_format", progress: 32, message: STAGE_MESSAGES.checking_format });

  const payload = buildAnalysisPayload(parsed);

  emit(onProgress, { stage: "ai_analysis", progress: 45, message: STAGE_MESSAGES.ai_analysis });

  const cleaningStart = Date.now();
  let aiAnalysisTimeMs = 0;

  const { analysis, durationMs } = await analyzeDocumentWithGemini(payload);
  aiAnalysisTimeMs = durationMs;

  emit(onProgress, { stage: "cleaning", progress: 62, message: STAGE_MESSAGES.cleaning });

  const { buffer: outputBuffer, fixes } = await formatCleanedDocument(parsed, analysis);

  emit(onProgress, { stage: "optimizing", progress: 78, message: STAGE_MESSAGES.optimizing });

  const afterScore = calculateAfterScores(beforeScore, {
    totalIssuesFixed: fixes.totalIssuesFixed,
    paragraphCount: parsed.paragraphs.length,
  });

  emit(onProgress, { stage: "generating", progress: 88, message: STAGE_MESSAGES.generating });

  const mergedAfter: typeof afterScore = {
    overall: Math.max(afterScore.overall, analysis.scores.overall - 5),
    formatting: Math.max(afterScore.formatting, analysis.scores.formatting - 5),
    consistency: Math.max(afterScore.consistency, analysis.scores.consistency - 5),
    structure: Math.max(afterScore.structure, analysis.scores.structure - 5),
    readability: Math.max(afterScore.readability, analysis.scores.readability - 5),
    academic: Math.max(afterScore.academic, analysis.scores.academic - 5),
  };

  emit(onProgress, { stage: "verifying", progress: 95, message: STAGE_MESSAGES.verifying });

  const outputFileName = fileName.replace(/\.docx$/i, "") + "_cleaned.docx";
  const cleaningTimeMs = Date.now() - cleaningStart;

  const report = {
    beforeScore,
    afterScore: mergedAfter,
    aiAnalysis: analysis,
    fixes,
    grammarSuggestions: analysis.grammar,
    warnings: analysis.issues.slice(0, 8),
    processingTimeMs: Date.now() - startTime,
    aiAnalysisTimeMs,
    cleaningTimeMs,
    pageCount: parsed.pageCount,
    paragraphCount: parsed.paragraphs.length,
    wordCount: parsed.wordCount,
  };

  emit(onProgress, { stage: "complete", progress: 100, message: STAGE_MESSAGES.complete });

  return { buffer: outputBuffer, report, outputFileName };
}

export type { CleanDocumentResult, CleaningReport, ProgressUpdate } from "./types";
