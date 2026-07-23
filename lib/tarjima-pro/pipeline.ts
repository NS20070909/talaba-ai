import type { PlanType } from "@/lib/user";
import { BATCH_SIZE, getTranslationLimits } from "./constants";
import { buildDocxFromParagraphs, buildPlainTextFromParagraphs } from "./docx-builder";
import { extractPdfTextWithOcr, selectModelChain, translateParagraphs, translatePlainText } from "./gemini";
import { buildPdfFromText } from "./pdf-output";
import {
  parseDocx,
  textToDocument,
  validateDocxMeta,
  validateDocumentPages,
  validatePdfMeta,
  validateTextInput,
} from "./parser";
import type { LangCode, TranslationResult } from "./types";

async function translateDocumentParagraphs(
  paragraphs: { index: number; text: string }[],
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean,
  isPremium: boolean,
  mode: "text" | "docx" | "pdf"
): Promise<{ translations: Map<number, string>; model: string }> {
  const totalLength = paragraphs.reduce((sum, p) => sum + p.text.length, 0);
  const modelChain = selectModelChain({
    mode,
    academic,
    isPremium,
    textLength: totalLength,
  });

  const allTranslations = new Map<number, string>();
  let usedModel = modelChain[0];

  for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
    const batch = paragraphs.slice(i, i + BATCH_SIZE);
    const { translations, model } = await translateParagraphs(
      batch,
      sourceLang,
      targetLang,
      academic,
      modelChain
    );
    usedModel = model;
    translations.forEach((value, key) => allTranslations.set(key, value));
  }

  return { translations: allTranslations, model: usedModel };
}

export async function translateText(
  text: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean,
  plan: PlanType
): Promise<TranslationResult> {
  const start = Date.now();
  const limits = getTranslationLimits(plan);

  if (academic && !limits.allowAcademic) {
    throw new Error("Akademik tarjima faqat Premium tarifda mavjud");
  }

  validateTextInput(text, limits);

  const modelChain = selectModelChain({
    mode: "text",
    academic,
    isPremium: limits.isPremium,
    textLength: text.length,
  });

  const { text: translatedText, model } = await translatePlainText(
    text.trim(),
    sourceLang,
    targetLang,
    academic,
    modelChain
  );

  const wordCount = translatedText.split(/\s+/).filter(Boolean).length;

  return {
    translatedText,
    meta: {
      sourceLang,
      targetLang,
      mode: "text",
      academic,
      model,
      processingTimeMs: Date.now() - start,
      wordCount,
      pageCount: 1,
    },
  };
}

export async function translateDocxFile(
  buffer: Buffer,
  fileName: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean,
  plan: PlanType
): Promise<TranslationResult> {
  const start = Date.now();
  const limits = getTranslationLimits(plan);

  if (academic && !limits.allowAcademic) {
    throw new Error("Akademik tarjima faqat Premium tarifda mavjud");
  }

  validateDocxMeta(fileName, buffer.length, limits);
  const doc = await parseDocx(buffer);
  validateDocumentPages(doc, limits);

  const items = doc.paragraphs.map((p) => ({ index: p.index, text: p.text }));
  const { translations, model } = await translateDocumentParagraphs(
    items,
    sourceLang,
    targetLang,
    academic,
    limits.isPremium,
    "docx"
  );

  const translatedText = buildPlainTextFromParagraphs(doc.paragraphs, translations);
  const { buffer: docxBuffer, fileName: outputFileName } = await buildDocxFromParagraphs(
    doc.paragraphs,
    translations,
    fileName
  );

  return {
    translatedText,
    buffer: docxBuffer,
    outputFileName,
    outputMimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    meta: {
      sourceLang,
      targetLang,
      mode: "docx",
      academic,
      model,
      processingTimeMs: Date.now() - start,
      wordCount: doc.wordCount,
      pageCount: doc.pageCount,
    },
  };
}

export async function translatePdfFile(
  buffer: Buffer,
  fileName: string,
  sourceLang: LangCode,
  targetLang: LangCode,
  academic: boolean,
  plan: PlanType
): Promise<TranslationResult> {
  const start = Date.now();
  const limits = getTranslationLimits(plan);

  if (!limits.allowPdf) {
    throw new Error("PDF tarjima faqat Premium tarifda mavjud");
  }
  if (academic && !limits.allowAcademic) {
    throw new Error("Akademik tarjima faqat Premium tarifda mavjud");
  }

  validatePdfMeta(fileName, buffer.length, limits);

  const extractedText = await extractPdfTextWithOcr(buffer);
  const doc = textToDocument(extractedText);
  validateDocumentPages(doc, limits);

  const items = doc.paragraphs.map((p) => ({ index: p.index, text: p.text }));
  const { translations, model } = await translateDocumentParagraphs(
    items,
    sourceLang,
    targetLang,
    academic,
    limits.isPremium,
    "pdf"
  );

  const translatedText = buildPlainTextFromParagraphs(doc.paragraphs, translations);
  const { buffer: docxBuffer, fileName: docxFileName } = await buildDocxFromParagraphs(
    doc.paragraphs,
    translations,
    fileName
  );
  const { buffer: pdfBuffer, fileName: pdfFileName } = await buildPdfFromText(
    translatedText,
    fileName
  );

  return {
    translatedText,
    buffer: docxBuffer,
    outputFileName: docxFileName,
    outputMimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pdfBuffer,
    pdfFileName,
    meta: {
      sourceLang,
      targetLang,
      mode: "pdf",
      academic,
      model,
      processingTimeMs: Date.now() - start,
      wordCount: doc.wordCount,
      pageCount: doc.pageCount,
    },
  };
}
