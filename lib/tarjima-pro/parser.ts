import mammoth from "mammoth";
import { MIN_TEXT_LENGTH, WORDS_PER_PAGE } from "./constants";
import type { ParsedDocument, ParsedParagraph, ParagraphKind, TranslationLimits } from "./types";

const HEADING_PATTERNS = [
  /^(kirish|kiritish|mundarija|asosiy\s+qism|xulosa|xulosalar|foydalanilgan\s+adabiyot|adabiyotlar|referenc|annotatsiya|abstract|introduction|conclusion|references)/i,
  /^(\d+[\.\)]\s|[IVXLC]+\.\s)/,
  /^(\d+\s+)?[A-ZА-ЯЁ][A-ZА-ЯЁa-zа-яё\s\-]{2,80}$/,
];

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

function isLocalHeading(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  return HEADING_PATTERNS.some((p) => p.test(trimmed));
}

function isTitleLine(text: string, index: number): boolean {
  if (index > 2) return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (/^(kirish|mundarija|content|table\s+of)/i.test(trimmed)) return false;
  return index === 0 || (index <= 1 && trimmed.length < 150);
}

function resolveKind(text: string, index: number, titleUsed: { value: boolean }): ParagraphKind {
  if (!titleUsed.value && isTitleLine(text, index)) {
    titleUsed.value = true;
    return "title";
  }
  if (isLocalHeading(text)) return "heading1";
  return "body";
}

export function textToDocument(rawText: string): ParsedDocument {
  const paragraphs = splitParagraphs(rawText);
  const titleUsed = { value: false };

  const parsed: ParsedParagraph[] = paragraphs.map((text, index) => ({
    index,
    text,
    kind: resolveKind(text, index, titleUsed),
  }));

  const wordCount = countWords(rawText);

  return {
    paragraphs: parsed,
    pageCount: estimatePageCount(wordCount),
    wordCount,
    rawText,
  };
}

export async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  let rawText: string;

  try {
    const result = await mammoth.extractRawText({ buffer });
    rawText = result.value || "";
  } catch {
    throw new Error("Hujjat o'qib bo'lmadi. Fayl buzilgan yoki parol bilan himoyalangan bo'lishi mumkin");
  }

  return textToDocument(rawText);
}

export function validateTextInput(text: string, limits: TranslationLimits): void {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    throw new Error("Matn juda qisqa. Kamida bir necha so'z kiriting");
  }
  if (trimmed.length > limits.maxTextChars) {
    throw new Error(
      limits.isPremium
        ? `Matn ${limits.maxTextChars.toLocaleString()} belgidan oshmasligi kerak`
        : `Matn ${limits.maxTextChars.toLocaleString()} belgidan oshmasligi kerak. Premium tarifda ko'proq matn mumkin`
    );
  }
}

export function validateDocxMeta(
  fileName: string,
  fileSize: number,
  limits: TranslationLimits
): void {
  if (!fileName.toLowerCase().endsWith(".docx")) {
    throw new Error("Faqat .docx formatdagi Word hujjatlar qabul qilinadi");
  }
  if (fileSize === 0) {
    throw new Error("Fayl bo'sh");
  }
  if (fileSize > limits.maxFileBytes) {
    const maxMb = Math.round(limits.maxFileBytes / (1024 * 1024));
    throw new Error(`Fayl hajmi ${maxMb} MB dan oshmasligi kerak`);
  }
}

export function validatePdfMeta(
  fileName: string,
  fileSize: number,
  limits: TranslationLimits
): void {
  if (!limits.allowPdf) {
    throw new Error("PDF tarjima faqat Premium tarifda mavjud");
  }
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    throw new Error("Faqat .pdf formatdagi hujjatlar qabul qilinadi");
  }
  if (fileSize === 0) {
    throw new Error("Fayl bo'sh");
  }
  if (fileSize > limits.maxFileBytes) {
    const maxMb = Math.round(limits.maxFileBytes / (1024 * 1024));
    throw new Error(`Fayl hajmi ${maxMb} MB dan oshmasligi kerak`);
  }
}

export function validateDocumentPages(doc: ParsedDocument, limits: TranslationLimits): void {
  if (doc.pageCount > limits.maxPages) {
    throw new Error(
      limits.isPremium
        ? `Hujjat ${limits.maxPages} betdan oshmasligi kerak`
        : `Hujjat ${limits.maxPages} betdan oshmasligi kerak. Premium tarifda katta hujjatlar mumkin`
    );
  }
  if (doc.wordCount < 5) {
    throw new Error("Hujjat bo'sh yoki juda qisqa");
  }
}
