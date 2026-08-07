import { QuizQuestion, QuizOption } from "./types";

/**
 * Universal Rule Engine Parser for Quiz Questions in Uzbek (Latin & Cyrillic), Russian, and English.
 */
export function parseQuizWithRuleEngine(rawText: string): QuizQuestion[] {
  const startTime = Date.now();
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  console.log(`[Parser] Rule Engine analyzing input text (${normalized.length} chars)...`);

  const answerKeysMap = extractAnswerKeysFromText(normalized);
  if (answerKeysMap.size > 0) {
    console.log(`[Parser] Answer key block detected at bottom (${answerKeysMap.size} answers found).`);
  }

  let questions: QuizQuestion[] = [];

  // Strategy 1: Separator blocks (====, ###, ----)
  const sepQuestions = parseSeparatorFormat(normalized);
  if (sepQuestions.length >= 2) {
    console.log(`[Parser] Separator strategy matched ${sepQuestions.length} questions.`);
    questions = sepQuestions;
  } else {
    // Strategy 2: Numbered Question Blocks (1. / 1) / 1- / Savol 1: / Вопрос 1:)
    const numberedQuestions = parseNumberedBlocks(normalized);
    if (numberedQuestions.length >= 2) {
      console.log(`[Parser] Numbered blocks strategy matched ${numberedQuestions.length} questions.`);
      questions = numberedQuestions;
    } else {
      // Strategy 3: Line-by-line streaming parser
      const lineQuestions = parseLineByLineFallback(normalized);
      console.log(`[Parser] Line-by-line strategy matched ${lineQuestions.length} questions.`);
      questions = numberedQuestions.length > 0 ? numberedQuestions : sepQuestions.length > 0 ? sepQuestions : lineQuestions;
    }
  }

  // Apply bottom answer keys if any question lacks a correct answer
  if (answerKeysMap.size > 0 && questions.length > 0) {
    questions.forEach((q) => {
      if (q.number !== undefined) {
        const targetAnswer = answerKeysMap.get(q.number);
        if (targetAnswer && !q.options.some((o) => o.isCorrect)) {
          const matchedOpt = q.options.find((o) => o.id === targetAnswer);
          if (matchedOpt) {
            matchedOpt.isCorrect = true;
            q.correctOptionId = targetAnswer;
          }
        }
      }
    });
  }

  const elapsed = Date.now() - startTime;
  console.log(`[Parser] Rule Engine completed | Parsed: ${questions.length} questions | Elapsed: ${elapsed}ms`);
  return questions;
}

// Map Cyrillic option letters to standard English letters
function normalizeOptionId(rawId: string): string {
  const clean = rawId.trim().toUpperCase();
  const map: Record<string, string> = {
    А: "A",
    Б: "B",
    В: "C",
    Г: "D",
    Д: "E",
    Е: "F",
    "1": "A",
    "2": "B",
    "3": "C",
    "4": "D",
    "5": "E",
  };
  return map[clean] || clean;
}

/**
 * Extracts bottom answer key mappings (e.g., "Javoblar: 1-A, 2-B, 3-C" or "Ответы: 1A 2B 3C")
 */
function extractAnswerKeysFromText(text: string): Map<number, string> {
  const answerMap = new Map<number, string>();
  const keyHeaderRegex = /(?:javoblar|to'g'ri\s+javoblar|ответы|ключи|answers|answer\s*keys)[:\s\n]+/i;
  const match = text.match(keyHeaderRegex);
  if (!match) return answerMap;

  const keySection = text.substring(match.index! + match[0].length);
  const pairRegex = /(\d+)[\.\)\:\-\s]+([A-Fa-f\u0410-\u0425\u0430-\u0455])/g;
  let m: RegExpExecArray | null;
  while ((m = pairRegex.exec(keySection)) !== null) {
    const qNum = parseInt(m[1], 10);
    const letter = normalizeOptionId(m[2]);
    answerMap.set(qNum, letter);
  }

  return answerMap;
}

/**
 * Splits inline options (e.g. "A) text1  B) text2  C) text3") into individual lines
 */
function expandInlineOptions(lines: string[]): string[] {
  const expanded: string[] = [];
  const inlineRegex = /(?:^|\s+)([\+\-\*]?\s*[A-Fa-f\u0410-\u0425\u0430-\u04551-6][\.\)\:\-]\s+)/g;

  for (const line of lines) {
    const matches = Array.from(line.matchAll(inlineRegex));
    if (matches.length >= 2) {
      let lastIndex = 0;
      for (let m = 0; m < matches.length; m++) {
        const matchIndex = matches[m].index!;
        if (m === 0) {
          const prefix = line.substring(0, matchIndex).trim();
          if (prefix) expanded.push(prefix);
        } else {
          const part = line.substring(lastIndex, matchIndex).trim();
          if (part) expanded.push(part);
        }
        lastIndex = matchIndex;
      }
      const lastPart = line.substring(lastIndex).trim();
      if (lastPart) expanded.push(lastPart);
    } else {
      expanded.push(line);
    }
  }
  return expanded;
}

// Strategy 1: Separators
function parseSeparatorFormat(text: string): QuizQuestion[] {
  const blocks = text.split(/(?:^|\n)(?:={3,}|#{3,}|-{3,})\s*(?:\n|$)/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length < 2) return [];

  const questions: QuizQuestion[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const rawLines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (rawLines.length < 2) continue;

    const lines = expandInlineOptions(rawLines);
    const questionText = lines[0].replace(/^[\d+.)\s\-]+/, "").trim();
    const options: QuizOption[] = [];
    let correctId: string | undefined = undefined;

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      let isCorrect = false;
      let optText = line;

      if (line.startsWith("+") || line.startsWith("*") || line.includes("[x]")) {
        isCorrect = true;
        optText = line.replace(/^[\+\*\#]\s*/, "").replace(/\[x\]/i, "").trim();
      } else if (/\s*\(?\+?\s*(?:to['`g]g['`r]i|правильный|correct)\)?$/i.test(line)) {
        isCorrect = true;
        optText = line.replace(/\s*\(?\+?\s*(?:to['`g]g['`r]i|правильный|correct)\)?$/i, "").trim();
      }

      const letterMatch = optText.match(/^([A-Za-z0-9\u0410-\u0425\u0430-\u0455]+)[\).\:\-]\s*(.*)/);
      let optionId = String.fromCharCode(65 + (j - 1));
      if (letterMatch) {
        optionId = normalizeOptionId(letterMatch[1]);
        optText = letterMatch[2].trim();
      }

      if (isCorrect && !correctId) {
        correctId = optionId;
      }

      options.push({
        id: optionId,
        text: optText || "Variant",
        isCorrect,
      });
    }

    if (options.length >= 2) {
      if (!correctId) {
        const lastLine = lines[lines.length - 1];
        const ansMatch = lastLine.match(/(?:javob|to'g'ri|answer|correct|ответ|ключ)[:\s]*([A-Za-z0-9\u0410-\u0425])/i);
        if (ansMatch) {
          correctId = normalizeOptionId(ansMatch[1]);
          options.forEach((o) => {
            if (o.id === correctId) o.isCorrect = true;
          });
        }
      }

      questions.push({
        id: `q_${i + 1}_${Math.random().toString(36).substring(2, 7)}`,
        number: i + 1,
        text: questionText,
        options,
        correctOptionId: correctId || undefined,
      });
    }
  }

  return questions;
}

// Strategy 2: Numbered Blocks (1. 1) 1- Savol 1: Вопрос 1: Question 1:)
function parseNumberedBlocks(text: string): QuizQuestion[] {
  const questionRegex = /(?:^|\n)(?:\d+[\.\)\-]|(?:Savol|Вопрос|Question)\s+\d+[\.\:\-]?)\s+/gi;
  const rawBlocks = text.split(questionRegex).map((b) => b.trim()).filter(Boolean);

  if (rawBlocks.length < 2) return [];

  const questions: QuizQuestion[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const rawLines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (rawLines.length < 2) continue;

    const lines = expandInlineOptions(rawLines);
    let questionLines: string[] = [];
    const options: QuizOption[] = [];
    let correctId: string | undefined = undefined;
    let parsingOptions = false;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const optMatch = line.match(/^([\+\-\*]?)\s*([A-Fa-f\u0410-\u0425\u0430-\u04551-6])[\.\)\:\-]\s+(.*)/);
      const isAnswerKeyLine = /(?:javob|to'g'ri\s+javob|answer|correct|ans|ответ|ключ)[:\s]*([A-Fa-f\u0410-\u04251-6])/i.test(line);

      if (optMatch && !isAnswerKeyLine) {
        parsingOptions = true;
        const marker = optMatch[1];
        const rawLetter = optMatch[2];
        const letter = normalizeOptionId(rawLetter);
        let optText = optMatch[3].trim();
        let isCorrect = marker === "+" || marker === "*" || line.includes("[x]") || /\s*\(?\+?\s*(?:to['`g]g['`r]i|правильный|correct)\)?$/i.test(line);

        if (isCorrect) {
          correctId = letter;
          optText = optText.replace(/\s*\(?\+?\s*(?:to['`g]g['`r]i|правильный|correct)\)?$/i, "").replace(/\[x\]/i, "").trim();
        }

        options.push({
          id: letter,
          text: optText || "Variant",
          isCorrect,
        });
      } else if (isAnswerKeyLine) {
        const keyMatch = line.match(/(?:javob|to'g'ri\s+javob|answer|correct|ans|ответ|ключ)[:\s]*([A-Fa-f\u0410-\u04251-6])/i);
        if (keyMatch) {
          correctId = normalizeOptionId(keyMatch[1]);
        }
      } else if (!parsingOptions) {
        questionLines.push(line);
      }
    }

    if (correctId) {
      options.forEach((o) => {
        if (o.id === correctId) o.isCorrect = true;
      });
    }

    const questionText = questionLines.join(" ").trim();
    if (questionText && options.length >= 2) {
      questions.push({
        id: `q_${i + 1}_${Math.random().toString(36).substring(2, 7)}`,
        number: i + 1,
        text: questionText,
        options,
        correctOptionId: correctId || undefined,
      });
    }
  }

  return questions;
}

// Strategy 3: Line-by-Line Streaming Fallback
function parseLineByLineFallback(text: string): QuizQuestion[] {
  const rawLines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const lines = expandInlineOptions(rawLines);
  const questions: QuizQuestion[] = [];

  let currentQText = "";
  let currentOptions: QuizOption[] = [];
  let currentCorrectId: string | undefined = undefined;

  const pushCurrent = () => {
    if (currentQText && currentOptions.length >= 2) {
      if (currentCorrectId) {
        currentOptions.forEach((o) => {
          if (o.id === currentCorrectId) o.isCorrect = true;
        });
      }
      questions.push({
        id: `q_${questions.length + 1}_${Math.random().toString(36).substring(2, 7)}`,
        number: questions.length + 1,
        text: currentQText,
        options: [...currentOptions],
        correctOptionId: currentCorrectId || undefined,
      });
    }
    currentQText = "";
    currentOptions = [];
    currentCorrectId = undefined;
  };

  for (const line of lines) {
    const isQuestionStart = /^(?:\d+[\.\)\-]|(?:Savol|Вопрос|Question)\s+\d+[\.\:\-]?)\s+/i.test(line);
    const optMatch = line.match(/^([\+\-\*]?)\s*([A-Fa-f\u0410-\u0425\u0430-\u04551-6])[\.\)\:\-]\s+(.*)/);

    if (isQuestionStart) {
      pushCurrent();
      currentQText = line
        .replace(/^(?:\d+[\.\)\-]|(?:Savol|Вопрос|Question)\s+\d+[\.\:\-]?)\s+/i, "")
        .trim();
    } else if (optMatch) {
      const marker = optMatch[1];
      const letter = normalizeOptionId(optMatch[2]);
      let optText = optMatch[3].trim();
      const isCorrect = marker === "+" || marker === "*" || line.includes("[x]") || /\s*\(?\+?\s*(?:to['`g]g['`r]i|правильный|correct)\)?$/i.test(line);

      if (isCorrect) {
        currentCorrectId = letter;
        optText = optText.replace(/\s*\(?\+?\s*(?:to['`g]g['`r]i|правильный|correct)\)?$/i, "").trim();
      }

      currentOptions.push({
        id: letter,
        text: optText || "Variant",
        isCorrect,
      });
    } else if (currentQText && currentOptions.length === 0) {
      currentQText += " " + line;
    }
  }
  pushCurrent();

  return questions;
}
