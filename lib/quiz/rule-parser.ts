import { QuizQuestion, QuizOption } from "./types";

export function parseQuizWithRuleEngine(rawText: string): QuizQuestion[] {
  const normalized = rawText.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  // Try Format A: "====" separator format (+correct, -wrong or just options)
  const formatAQuestions = parseSeparatorFormat(normalized);
  if (formatAQuestions.length > 0) {
    return formatAQuestions;
  }

  // Try Format B: Numbered question blocks (1. 2. 3. or 1) 2))
  const formatBQuestions = parseNumberedBlocks(normalized);
  if (formatBQuestions.length > 0) {
    return formatBQuestions;
  }

  // Try Format C: Line-by-line fallback parser
  return parseLineByLineFallback(normalized);
}

// Format A: Separators like ==== or ###
function parseSeparatorFormat(text: string): QuizQuestion[] {
  const blocks = text.split(/(?:^|\n)(?:={3,}|#{3,}|-{3,})\s*(?:\n|$)/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length < 2) return [];

  const questions: QuizQuestion[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const questionText = lines[0].replace(/^[\d+.)\s]+/, "").trim();
    const options: QuizOption[] = [];
    let correctId: string | undefined = undefined;

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      let isCorrect = false;
      let optText = line;

      if (line.startsWith("+")) {
        isCorrect = true;
        optText = line.substring(1).trim();
      } else if (line.startsWith("-")) {
        isCorrect = false;
        optText = line.substring(1).trim();
      } else if (/^[*#]\s*/.test(line)) {
        isCorrect = true;
        optText = line.replace(/^[*#]\s*/, "").trim();
      } else if (/\s*\(?\+?\s*to['`g]g['`r]i\)?$/i.test(line) || line.includes("[x]")) {
        isCorrect = true;
        optText = line.replace(/\s*\(?\+?\s*to['`g]g['`r]i\)?$/i, "").replace(/\[x\]/i, "").trim();
      }

      // Match letter prefixes (A), B), C) or A., B., C. or A:)
      const letterMatch = optText.match(/^([A-Za-z0-9]+)[\).\:\-]\s*(.*)/);
      let optionId = String.fromCharCode(65 + (j - 1)); // A, B, C, D default
      if (letterMatch) {
        optionId = letterMatch[1].toUpperCase();
        optText = letterMatch[2];
      }

      if (isCorrect && !correctId) {
        correctId = optionId;
      }

      options.push({
        id: optionId,
        text: optText,
        isCorrect,
      });
    }

    if (options.length >= 2) {
      // If none marked correct, check if last line says "Javob: A" or "Answer: B"
      if (!correctId) {
        const lastLine = lines[lines.length - 1];
        const ansMatch = lastLine.match(/(?:javob|to'g'ri|answer|correct|ключ)[:\s]*([A-Za-z0-9]+)/i);
        if (ansMatch) {
          correctId = ansMatch[1].toUpperCase();
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
        correctOptionId: correctId,
      });
    }
  }

  return questions;
}

// Format B: Standard 1. 2. 3. Question Blocks
function parseNumberedBlocks(text: string): QuizQuestion[] {
  // Regex splitting by numbers like "1. ", "2. ", "1) ", "2) " at line starts
  const questionRegex = /(?:^|\n)(?:\d+[\.\)]|\?\s*|\bSavol\s+\d+[:\.]?)\s+/i;
  const rawBlocks = text.split(questionRegex).map((b) => b.trim()).filter(Boolean);

  if (rawBlocks.length < 2) return [];

  const questions: QuizQuestion[] = [];

  for (let i = 0; i < rawBlocks.length; i++) {
    const block = rawBlocks[i];
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let questionLines: string[] = [];
    const options: QuizOption[] = [];
    let correctId: string | undefined = undefined;

    let parsingOptions = false;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const optMatch = line.match(/^([\+\-\*]?)\s*([A-Da-d1-4])[\.\)\:]\s+(.*)/);
      const isAnswerKeyLine = /(?:javob|to'g'ri\s+javob|answer|correct|ans)[:\s]*([A-Da-d1-4])/i.test(line);

      if (optMatch && !isAnswerKeyLine) {
        parsingOptions = true;
        const marker = optMatch[1];
        const letter = optMatch[2].toUpperCase();
        const optText = optMatch[3].trim();
        const isCorrect = marker === "+" || marker === "*" || line.includes("[x]");

        if (isCorrect) correctId = letter;

        options.push({
          id: letter,
          text: optText,
          isCorrect,
        });
      } else if (isAnswerKeyLine) {
        const keyMatch = line.match(/(?:javob|to'g'ri\s+javob|answer|correct|ans)[:\s]*([A-Da-d1-4])/i);
        if (keyMatch) {
          correctId = keyMatch[1].toUpperCase();
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
        correctOptionId: correctId,
      });
    }
  }

  return questions;
}

// Format C: Line by line regex fallback
function parseLineByLineFallback(text: string): QuizQuestion[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
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
        correctOptionId: currentCorrectId,
      });
    }
    currentQText = "";
    currentOptions = [];
    currentCorrectId = undefined;
  };

  for (const line of lines) {
    const isQuestionStart = /^\d+[\.\)]\s+/.test(line) || /^Savol\s+\d+/i.test(line);
    const optMatch = line.match(/^([\+\-\*]?)\s*([A-Da-d1-4])[\.\)]\s+(.*)/);

    if (isQuestionStart) {
      pushCurrent();
      currentQText = line.replace(/^\d+[\.\)]\s+/, "").replace(/^Savol\s+\d+[:\.]?\s*/i, "").trim();
    } else if (optMatch) {
      const marker = optMatch[1];
      const letter = optMatch[2].toUpperCase();
      const optText = optMatch[3].trim();
      const isCorrect = marker === "+" || marker === "*";
      if (isCorrect) currentCorrectId = letter;

      currentOptions.push({
        id: letter,
        text: optText,
        isCorrect,
      });
    } else if (currentQText && currentOptions.length === 0) {
      currentQText += " " + line;
    }
  }
  pushCurrent();

  return questions;
}
