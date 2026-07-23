import {
  AlignmentType,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { ParsedParagraph } from "./types";

const FONT = "Times New Roman";
const BODY_SIZE = 28;
const TITLE_SIZE = 32;
const HEADING1_SIZE = 28;

function buildParagraph(text: string, kind: ParsedParagraph["kind"]): Paragraph {
  if (kind === "title") {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360, line: 360, lineRule: LineRuleType.AUTO },
      children: [new TextRun({ text, font: FONT, size: TITLE_SIZE, bold: true })],
    });
  }

  if (kind === "heading1" || kind === "heading2") {
    return new Paragraph({
      spacing: { before: 280, after: 160, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({
          text,
          font: FONT,
          size: HEADING1_SIZE,
          bold: true,
        }),
      ],
    });
  }

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160, line: 360, lineRule: LineRuleType.AUTO },
    indent: { firstLine: 709 },
    children: [new TextRun({ text, font: FONT, size: BODY_SIZE })],
  });
}

export async function buildDocxFromParagraphs(
  paragraphs: ParsedParagraph[],
  translations: Map<number, string>,
  originalFileName?: string
): Promise<{ buffer: Buffer; fileName: string }> {
  const children = paragraphs.map((p) => {
    const text = translations.get(p.index) ?? p.text;
    return buildParagraph(text, p.kind);
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const baseName = originalFileName
    ? originalFileName.replace(/\.(docx|pdf)$/i, "")
    : "tarjima";
  const fileName = `${baseName}_tarjima.docx`;

  return { buffer, fileName };
}

export function buildPlainTextFromParagraphs(
  paragraphs: ParsedParagraph[],
  translations: Map<number, string>
): string {
  return paragraphs
    .map((p) => translations.get(p.index) ?? p.text)
    .join("\n\n");
}
