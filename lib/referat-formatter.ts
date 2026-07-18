import mammoth from "mammoth";
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

/** OTM standartlari (Times New Roman, 1.5 interval, standart chegaralar) */
const FONT = "Times New Roman";
const BODY_SIZE = 28; // 14pt
const TITLE_SIZE = 32; // 16pt
const HEADING_SIZE = 28; // 14pt bold

const MARGIN_LEFT = 1701; // ~3 cm
const MARGIN_RIGHT = 851; // ~1.5 cm
const MARGIN_TOP = 1134; // ~2 cm
const MARGIN_BOTTOM = 1134; // ~2 cm
const FIRST_LINE_INDENT = 709; // ~1.25 cm

const HEADING_PATTERNS = [
  /^(kirish|kiritish|mundarija|asosiy\s+qism|xulosa|xulosalar|foydalanilgan\s+adabiyot|adabiyotlar|referenc)/i,
  /^(\d+[\.\)]\s|[IVXLC]+\.\s)/,
  /^(\d+\s+)?[A-ZА-ЯЁ][A-ZА-ЯЁa-zа-яё\s\-]{2,60}$/,
];

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  return HEADING_PATTERNS.some((p) => p.test(trimmed));
}

function isTitleLine(line: string, index: number, totalLines: number): boolean {
  if (index > 2) return false;
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 200) return false;
  if (/^(kirish|mundarija|content|table\s+of)/i.test(trimmed)) return false;
  return index === 0 || (index <= 1 && totalLines > 3 && trimmed.length < 150);
}

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

function buildParagraph(text: string, kind: "title" | "heading" | "body"): Paragraph {
  if (kind === "title") {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 480, after: 360, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({
          text,
          font: FONT,
          size: TITLE_SIZE,
          bold: true,
        }),
      ],
    });
  }

  if (kind === "heading") {
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 280, after: 160, line: 360, lineRule: LineRuleType.AUTO },
      children: [
        new TextRun({
          text,
          font: FONT,
          size: HEADING_SIZE,
          bold: true,
        }),
      ],
      heading: HeadingLevel.HEADING_2,
    });
  }

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 360, lineRule: LineRuleType.AUTO },
    indent: { firstLine: FIRST_LINE_INDENT },
    children: [
      new TextRun({
        text,
        font: FONT,
        size: BODY_SIZE,
      }),
    ],
  });
}

export async function formatReferatDocx(inputBuffer: Buffer): Promise<Buffer> {
  const { value: rawText } = await mammoth.extractRawText({ buffer: inputBuffer });

  if (!rawText || rawText.trim().length < 20) {
    throw new Error("Hujjat bo'sh yoki o'qib bo'lmadi. To'g'ri .docx fayl yuklang.");
  }

  const paragraphs = splitParagraphs(rawText);
  if (paragraphs.length === 0) {
    throw new Error("Hujjatda matn topilmadi.");
  }

  const docChildren: Paragraph[] = [];
  let titleUsed = false;

  paragraphs.forEach((text, index) => {
    if (!titleUsed && isTitleLine(text, index, paragraphs.length)) {
      docChildren.push(buildParagraph(text, "title"));
      titleUsed = true;
      return;
    }

    if (isHeading(text)) {
      docChildren.push(buildParagraph(text, "heading"));
      return;
    }

    docChildren.push(buildParagraph(text, "body"));
  });

  const doc = new Document({
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

  return Packer.toBuffer(doc);
}
