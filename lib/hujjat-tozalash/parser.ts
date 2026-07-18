import mammoth from "mammoth";
import { WORDS_PER_PAGE } from "./constants";
import type { ParsedDocument } from "./types";

function splitParagraphs(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .join(" ")
        .trim()
    )
    .filter((p) => p.length > 0);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimatePageCount(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_PAGE));
}

function detectMixedFonts(rawText: string): string[] {
  const fonts: string[] = [];
  if (/[""''–—]/.test(rawText)) fonts.push("smart-quotes");
  if (/\t/.test(rawText)) fonts.push("tabs-detected");
  if (/  {2,}/.test(rawText)) fonts.push("irregular-spacing");
  return fonts;
}

export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  let rawText: string;

  try {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || "";
  } catch {
    throw new Error("Hujjat o'qib bo'lmadi. Fayl buzilgan yoki parol bilan himoyalangan bo'lishi mumkin");
  }

  const paragraphs = splitParagraphs(rawText);
  const wordCount = countWords(rawText);
  const pageCount = estimatePageCount(wordCount);

  return {
    paragraphs,
    rawText,
    pageCount,
    wordCount,
    estimatedFonts: detectMixedFonts(rawText),
  };
}

/** Optimized excerpt for Gemini — limits token usage */
export function buildAnalysisPayload(doc: ParsedDocument): string {
  const indexed = doc.paragraphs.map((text, i) => ({
    index: i,
    text: text.length > 400 ? text.slice(0, 400) + "…" : text,
    length: text.length,
  }));

  return JSON.stringify({
    pageCount: doc.pageCount,
    wordCount: doc.wordCount,
    paragraphCount: doc.paragraphs.length,
    formattingHints: doc.estimatedFonts,
    paragraphs: indexed.slice(0, 120),
  });
}
