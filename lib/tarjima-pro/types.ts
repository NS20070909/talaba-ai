import type { PlanType } from "@/lib/user";

export type LangCode = "uz" | "en" | "ru";

export type TranslationMode = "text" | "docx" | "pdf";

export type ParagraphKind = "title" | "heading1" | "heading2" | "body";

export interface ParsedParagraph {
  index: number;
  text: string;
  kind: ParagraphKind;
}

export interface ParsedDocument {
  paragraphs: ParsedParagraph[];
  pageCount: number;
  wordCount: number;
  rawText: string;
}

export interface TranslationLimits {
  maxFileBytes: number;
  maxPages: number;
  maxTextChars: number;
  dailyLimit: number;
  isPremium: boolean;
  allowPdf: boolean;
  allowAcademic: boolean;
}

export interface TranslationMeta {
  sourceLang: LangCode;
  targetLang: LangCode;
  mode: TranslationMode;
  academic: boolean;
  model: string;
  processingTimeMs: number;
  wordCount: number;
  pageCount: number;
}

export interface TranslationResult {
  translatedText: string;
  buffer?: Buffer;
  outputFileName?: string;
  outputMimeType?: string;
  pdfBuffer?: Buffer;
  pdfFileName?: string;
  meta: TranslationMeta;
}

export interface UsageInfo {
  plan: PlanType;
  used: number;
  limit: number;
  isUnlimited: boolean;
  maxPages: number;
  maxFileMb: number;
  maxTextChars: number;
  allowPdf: boolean;
  allowAcademic: boolean;
}
