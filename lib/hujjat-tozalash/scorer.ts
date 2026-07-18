import type { DocumentScores, ParsedDocument } from "./types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countDoubleSpaces(text: string): number {
  return (text.match(/  +/g) || []).length;
}

function countEmptyBlocks(rawText: string): number {
  return (rawText.match(/\n{3,}/g) || []).length;
}

function scoreFormatting(doc: ParsedDocument): number {
  let score = 100;
  score -= countDoubleSpaces(doc.rawText) * 2;
  score -= countEmptyBlocks(doc.rawText) * 5;
  score -= doc.estimatedFonts.length * 8;
  return clamp(score);
}

function scoreConsistency(doc: ParsedDocument): number {
  let score = 100;
  const lengths = doc.paragraphs.map((p) => p.length);
  const avg = lengths.reduce((a, b) => a + b, 0) / Math.max(lengths.length, 1);
  const variance =
    lengths.reduce((sum, l) => sum + Math.abs(l - avg), 0) / Math.max(lengths.length, 1);
  if (variance > 200) score -= 15;
  if (variance > 400) score -= 15;
  return clamp(score);
}

function scoreStructure(doc: ParsedDocument): number {
  let score = 70;
  if (doc.paragraphs.length >= 5) score += 10;
  if (doc.paragraphs.length >= 10) score += 10;

  const hasIntro = doc.paragraphs.some((p) => /^(kirish|kiritish|introduction)/i.test(p));
  const hasConclusion = doc.paragraphs.some((p) => /^(xulosa|xulosalar|conclusion)/i.test(p));
  const hasRefs = doc.paragraphs.some((p) =>
    /^(foydalanilgan|adabiyot|referenc|manbalar)/i.test(p)
  );

  if (hasIntro) score += 5;
  if (hasConclusion) score += 5;
  if (hasRefs) score += 5;

  return clamp(score);
}

function scoreReadability(doc: ParsedDocument): number {
  let score = 85;
  const avgWords =
    doc.wordCount / Math.max(doc.paragraphs.length, 1);
  if (avgWords > 80) score -= 10;
  if (avgWords > 120) score -= 10;
  if (avgWords < 5) score -= 15;
  return clamp(score);
}

function scoreAcademic(doc: ParsedDocument): number {
  let score = 75;
  const formalMarkers = doc.paragraphs.filter((p) =>
    /(shuningdek|bunda|xulosa|tadqiqot|muallif|nazariya)/i.test(p)
  ).length;
  score += Math.min(15, formalMarkers * 2);
  return clamp(score);
}

export function calculateDocumentScores(doc: ParsedDocument): DocumentScores {
  const formatting = scoreFormatting(doc);
  const consistency = scoreConsistency(doc);
  const structure = scoreStructure(doc);
  const readability = scoreReadability(doc);
  const academic = scoreAcademic(doc);
  const overall = clamp(
    formatting * 0.25 +
      consistency * 0.2 +
      structure * 0.2 +
      readability * 0.15 +
      academic * 0.2
  );

  return { overall, formatting, consistency, structure, readability, academic };
}

export function calculateAfterScores(
  before: DocumentScores,
  fixes: { totalIssuesFixed: number; paragraphCount: number }
): DocumentScores {
  const boost = Math.min(35, fixes.totalIssuesFixed * 2);
  const ratio = Math.min(1, fixes.totalIssuesFixed / Math.max(fixes.paragraphCount, 1));

  return {
    overall: clamp(Math.max(before.overall + boost, before.overall + 10)),
    formatting: clamp(before.formatting + boost * 0.4 + ratio * 20),
    consistency: clamp(before.consistency + boost * 0.35 + ratio * 15),
    structure: clamp(before.structure + boost * 0.15),
    readability: clamp(before.readability + boost * 0.25),
    academic: clamp(before.academic + boost * 0.1),
  };
}
