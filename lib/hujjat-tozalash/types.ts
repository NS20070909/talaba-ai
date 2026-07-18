export type ProcessingStage =
  | "validating"
  | "reading"
  | "analyzing"
  | "checking_format"
  | "ai_analysis"
  | "cleaning"
  | "optimizing"
  | "generating"
  | "verifying"
  | "complete"
  | "error";

export interface ProgressUpdate {
  stage: ProcessingStage;
  progress: number;
  message: string;
}

export interface DocumentScores {
  overall: number;
  formatting: number;
  consistency: number;
  structure: number;
  readability: number;
  academic: number;
}

export interface GrammarSuggestion {
  paragraphIndex: number;
  original: string;
  suggestion: string;
  reason: string;
  language: "uz" | "en" | "ru" | "unknown";
}

export interface DuplicateItem {
  paragraphIndex: number;
  text: string;
  duplicateOfIndex: number;
}

export interface HeadingInfo {
  paragraphIndex: number;
  text: string;
  level: "title" | "heading1" | "heading2" | "heading3" | "section";
  academicRole?:
    | "title"
    | "abstract"
    | "introduction"
    | "chapter"
    | "section"
    | "conclusion"
    | "references"
    | "appendix"
    | "other";
}

export interface ParagraphFix {
  paragraphIndex: number;
  fixes: string[];
}

export interface AiAnalysisResult {
  documentScore: number;
  issues: string[];
  recommendations: string[];
  headings: HeadingInfo[];
  paragraphFixes: ParagraphFix[];
  grammar: GrammarSuggestion[];
  duplicates: DuplicateItem[];
  formatting: string[];
  tables: string[];
  images: string[];
  scores: DocumentScores;
}

export interface FixReport {
  fontsUnified: number;
  paragraphsFixed: number;
  spacingCorrected: number;
  marginsCorrected: number;
  tablesImproved: number;
  imagesOptimized: number;
  duplicatesRemoved: number;
  headingsStandardized: number;
  referencesImproved: number;
  emptyParagraphsRemoved: number;
  doubleSpacesFixed: number;
  totalIssuesFixed: number;
}

export interface CleaningReport {
  beforeScore: DocumentScores;
  afterScore: DocumentScores;
  aiAnalysis: AiAnalysisResult;
  fixes: FixReport;
  grammarSuggestions: GrammarSuggestion[];
  warnings: string[];
  processingTimeMs: number;
  aiAnalysisTimeMs: number;
  cleaningTimeMs: number;
  pageCount: number;
  paragraphCount: number;
  wordCount: number;
}

export interface ParsedDocument {
  paragraphs: string[];
  rawText: string;
  pageCount: number;
  wordCount: number;
  estimatedFonts: string[];
}

export interface CleanDocumentResult {
  buffer: Buffer;
  report: CleaningReport;
  outputFileName: string;
}

export type ProgressCallback = (update: ProgressUpdate) => void;

/** Future-ready: PDF, images, OCR — not implemented in v1 */
export type SupportedInputFormat = "docx";

export interface DocumentLimits {
  maxFileBytes: number;
  maxPages: number;
  isPremium: boolean;
}
