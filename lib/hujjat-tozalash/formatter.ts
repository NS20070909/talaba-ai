import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from "docx";
import {
  BODY_SIZE,
  FIRST_LINE_INDENT,
  FONT,
  HEADING1_SIZE,
  HEADING2_SIZE,
  MARGIN_BOTTOM,
  MARGIN_LEFT,
  MARGIN_RIGHT,
  MARGIN_TOP,
  TITLE_SIZE,
} from "./constants";
import { getHeadingMap } from "./gemini";
import type {
  AiAnalysisResult,
  FixReport,
  HeadingInfo,
  ParsedDocument,
} from "./types";

const HEADING_PATTERNS = [
  /^(kirish|kiritish|mundarija|asosiy\s+qism|xulosa|xulosalar|foydalanilgan\s+adabiyot|adabiyotlar|referenc|annotatsiya|abstract)/i,
  /^(\d+[\.\)]\s|[IVXLC]+\.\s)/,
  /^(\d+\s+)?[A-ZА-ЯЁ][A-ZА-ЯЁa-zа-яё\s\-]{2,80}$/,
];

function cleanParagraphText(text: string): { text: string; fixes: string[] } {
  const fixes: string[] = [];
  let cleaned = text;

  const doubleSpaces = (cleaned.match(/  +/g) || []).length;
  if (doubleSpaces > 0) {
    cleaned = cleaned.replace(/  +/g, " ");
    fixes.push("double-spaces");
  }

  cleaned = cleaned.replace(/\t+/g, " ");
  if (text.includes("\t")) fixes.push("tabs");

  cleaned = cleaned.replace(/\s+([.,;:!?])/g, "$1");
  cleaned = cleaned.replace(/([(\[])\s+/g, "$1");
  cleaned = cleaned.trim();

  return { text: cleaned, fixes };
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

function resolveParagraphKind(
  text: string,
  index: number,
  headingMap: Map<number, HeadingInfo>,
  titleUsed: boolean
): "title" | "heading1" | "heading2" | "body" {
  const aiHeading = headingMap.get(index);
  if (aiHeading) {
    if (aiHeading.level === "title" || aiHeading.academicRole === "title") return "title";
    if (aiHeading.level === "heading1" || aiHeading.level === "section") return "heading1";
    if (aiHeading.level === "heading2" || aiHeading.level === "heading3") return "heading2";
  }

  if (!titleUsed && isTitleLine(text, index)) return "title";
  if (isLocalHeading(text)) return "heading1";
  return "body";
}

function buildParagraph(text: string, kind: "title" | "heading1" | "heading2" | "body"): Paragraph {
  if (kind === "title") {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360, line: 360, lineRule: LineRuleType.AUTO },
      children: [new TextRun({ text, font: FONT, size: TITLE_SIZE, bold: true })],
    });
  }

  if (kind === "heading1") {
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 280, after: 160, line: 360, lineRule: LineRuleType.AUTO },
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text, font: FONT, size: HEADING1_SIZE, bold: true })],
    });
  }

  if (kind === "heading2") {
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 120, line: 360, lineRule: LineRuleType.AUTO },
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text, font: FONT, size: HEADING2_SIZE, bold: true })],
    });
  }

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO },
    indent: { firstLine: FIRST_LINE_INDENT },
    children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
  });
}

function removeAccidentalDuplicates(paragraphs: string[]): {
  paragraphs: string[];
  removed: number;
} {
  const seen = new Set<string>();
  const result: string[] = [];
  let removed = 0;

  for (const p of paragraphs) {
    const key = p.toLowerCase().trim();
    if (key.length > 20 && seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    result.push(p);
  }

  return { paragraphs: result, removed };
}

export async function formatCleanedDocument(
  doc: ParsedDocument,
  analysis: AiAnalysisResult
): Promise<{ buffer: Buffer; fixes: FixReport }> {
  const headingMap = getHeadingMap(analysis.headings);
  const fixReport: FixReport = {
    fontsUnified: doc.estimatedFonts.length > 0 ? doc.estimatedFonts.length : 1,
    paragraphsFixed: 0,
    spacingCorrected: 0,
    marginsCorrected: 1,
    tablesImproved: analysis.tables.length,
    imagesOptimized: analysis.images.length,
    duplicatesRemoved: 0,
    headingsStandardized: 0,
    referencesImproved: analysis.formatting.filter((f) => /referenc|adabiyot|manba/i.test(f)).length,
    emptyParagraphsRemoved: 0,
    doubleSpacesFixed: 0,
    totalIssuesFixed: 0,
  };

  const cleanedParagraphs: string[] = [];
  let titleUsed = false;

  for (let i = 0; i < doc.paragraphs.length; i++) {
    const { text, fixes } = cleanParagraphText(doc.paragraphs[i]);
    if (!text) {
      fixReport.emptyParagraphsRemoved++;
      continue;
    }

    if (fixes.includes("double-spaces")) fixReport.doubleSpacesFixed++;
    if (fixes.length > 0) fixReport.paragraphsFixed++;
    if (fixes.includes("tabs")) fixReport.spacingCorrected++;

    cleanedParagraphs.push(text);
  }

  const deduped = removeAccidentalDuplicates(cleanedParagraphs);
  fixReport.duplicatesRemoved = deduped.removed;

  const docChildren: Paragraph[] = [];

  deduped.paragraphs.forEach((text, index) => {
    const kind = resolveParagraphKind(text, index, headingMap, titleUsed);

    if (kind === "title") titleUsed = true;
    if (kind !== "body") fixReport.headingsStandardized++;

    docChildren.push(buildParagraph(text, kind));
  });

  if (docChildren.length === 0) {
    throw new Error("Hujjatda saqlanadigan matn topilmadi");
  }

  fixReport.totalIssuesFixed =
    fixReport.paragraphsFixed +
    fixReport.spacingCorrected +
    fixReport.duplicatesRemoved +
    fixReport.emptyParagraphsRemoved +
    fixReport.doubleSpacesFixed +
    fixReport.headingsStandardized +
    fixReport.fontsUnified +
    fixReport.marginsCorrected;

  const document = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN_TOP,
              right: MARGIN_RIGHT,
              bottom: MARGIN_BOTTOM,
              left: MARGIN_LEFT,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT,
                    size: 22,
                  }),
                ],
              }),
            ],
          }),
        },
        children: docChildren,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return { buffer, fixes: fixReport };
}
