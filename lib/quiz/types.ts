export interface QuizOption {
  id: string; // e.g. "A", "B", "C", "D", "1", "2"
  text: string;
  isCorrect: boolean;
}

export interface ValidationIssue {
  type:
    | "MISSING_ANSWER"
    | "DUPLICATE_QUESTION"
    | "BROKEN_NUMBERING"
    | "EMPTY_QUESTION"
    | "EMPTY_OPTION"
    | "MULTIPLE_CORRECT"
    | "LOW_CONFIDENCE";
  message: string;
  severity: "error" | "warning" | "info";
  suggestedFix?: string;
}

export interface QuizQuestion {
  id: string; // unique question ID
  number?: number;
  text: string;
  options: QuizOption[];
  correctOptionId?: string; // id of correct option
  explanation?: string; // generated only for flawed/problematic questions
  validationIssues?: ValidationIssue[];
  isAiParsed?: boolean;
}

export interface ParsedQuizResult {
  title: string;
  sourceFileName?: string;
  rawText: string;
  questions: QuizQuestion[];
  overallValidation: {
    totalQuestions: number;
    validQuestions: number;
    flawedQuestions: number;
    issues: ValidationIssue[];
  };
  parserMethod: "RULE" | "REGEX" | "HYBRID_AI" | "OCR";
}

export type QuestionSelectionMode = "ALL" | "RANGE" | "MANUAL" | "RANDOM" | "SMART_RANDOM";
export type QuizBuilderMode = "SINGLE" | "MULTI";

export interface QuizTestSet {
  id: string;
  index: number; // 1-based index (e.g., 1, 2, 3...)
  title: string; // e.g. "Test 1 (1–25)"
  startNum: number;
  endNum: number;
  questions: QuizQuestion[];
}

export interface QuizCollection {
  title: string;
  totalQuestions: number;
  batchSize: number;
  testSets: QuizTestSet[];
}

export interface QuizConfig {
  title?: string;
  builderMode?: QuizBuilderMode; // "SINGLE" | "MULTI"
  multiTestBatchSize?: number; // e.g., 20, 25, 30, 40, 50, 100
  selectionMode: QuestionSelectionMode;
  rangeStart?: number;
  rangeEnd?: number;
  targetCount?: number;
  selectedQuestionIds?: string[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  timerSeconds: number; // 0 = no timer, otherwise seconds per question (5, 10, 15, 20, 30, 60, custom)
  splitBatchSize?: number; // e.g., 50 -> splits 130 into 50, 50, 30
}

export interface QuizHistoryRecord {
  id: string;
  userId: number;
  title: string;
  sourceFileName?: string;
  questionCount: number;
  settings: QuizConfig;
  questions: QuizQuestion[];
  collection?: QuizCollection;
  telegramMessageIds?: number[];
  createdAt: string;
  updatedAt: string;
}

