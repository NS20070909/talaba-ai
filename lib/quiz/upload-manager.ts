import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { performOcrOnImage, performOcrOnPdf } from "./ocr-adapter";
import { calculateFileHash, getCachedQuizByHash } from "./cache";
import { QuizQuestion } from "./types";

export interface ExtractedFileContent {
  fileHash: string;
  fileName: string;
  fileType: string;
  text: string;
  needsOcr: boolean;
  isCached?: boolean;
  cachedQuestions?: QuizQuestion[];
  extractionTimeMs?: number;
}

/**
 * Text Buffer Decoder supporting UTF-8, UTF-16LE, UTF-16BE, Windows-1251, and ANSI
 */
function decodeTextBuffer(buffer: Buffer): string {
  if (!buffer || buffer.length === 0) return "";

  // 1. Check BOM (Byte Order Mark)
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buffer.subarray(3));
  }

  // 2. Try Standard UTF-8
  const utf8Text = buffer.toString("utf-8");
  if (!utf8Text.includes("\uFFFD")) {
    return utf8Text.trim();
  }

  // 3. Fallback to Windows-1251 for Cyrillic / Uzbek ANSI
  try {
    const win1251Text = new TextDecoder("windows-1251").decode(buffer);
    if (win1251Text && !win1251Text.includes("\uFFFD")) {
      return win1251Text.trim();
    }
  } catch {}

  return utf8Text.trim();
}

export async function extractTextFromFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<ExtractedFileContent> {
  const startTime = Date.now();
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const fileHash = calculateFileHash(fileBuffer);

  console.log(`[Upload] File: ${fileName} (${ext}) | Size: ${(fileBuffer.length / 1024).toFixed(1)} KB | Hash: ${fileHash.substring(0, 8)}`);

  // Check SHA-256 fingerprint cache first
  const cached = await getCachedQuizByHash(fileHash);
  if (cached && cached.rawText) {
    const elapsed = Date.now() - startTime;
    console.log(`[Extract] SHA-256 Cache Hit (${elapsed}ms)`);
    return {
      fileHash,
      fileName,
      fileType: ext,
      text: cached.rawText,
      needsOcr: false,
      isCached: true,
      cachedQuestions: cached.questions,
      extractionTimeMs: elapsed,
    };
  }

  let text = "";
  let needsOcr = false;

  // 1. Plain Text / CSV with Encoding Support (UTF-8, UTF-16, Win-1251)
  if (ext === "txt" || ext === "csv" || mimeType?.includes("text/plain") || mimeType?.includes("text/csv")) {
    text = decodeTextBuffer(fileBuffer);
  }
  // 2. DOCX / DOC
  else if (ext === "docx" || ext === "doc" || mimeType?.includes("wordprocessingml") || mimeType?.includes("msword")) {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value ? result.value.trim() : "";
    } catch (err: any) {
      console.warn("[Extract] Mammoth extraction warning:", err?.message || err);
    }
    if (!text || text.length < 30) {
      text = decodeTextBuffer(fileBuffer).replace(/[^\x20-\x7E\s\u0400-\u04FF]/g, " ").trim();
    }
  }
  // 3. XLS / XLSX Sheet & Cell Extraction (SheetJS)
  else if (ext === "xlsx" || ext === "xls" || mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) {
    try {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetTexts: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;
        const sheetTxt = XLSX.utils.sheet_to_txt(sheet);
        if (sheetTxt && sheetTxt.trim()) {
          sheetTexts.push(sheetTxt.trim());
        }
      }
      text = sheetTexts.join("\n\n");
    } catch (xlsErr: any) {
      console.warn("[Extract] XLSX sheet extraction warning:", xlsErr?.message || xlsErr);
      text = decodeTextBuffer(fileBuffer).replace(/<[^>]+>/g, " ").trim();
    }
  }
  // 4. Images (JPG, JPEG, PNG, WEBP, HEIC)
  else if (["jpg", "jpeg", "png", "webp", "heic"].includes(ext) || mimeType?.startsWith("image/")) {
    needsOcr = true;
    console.log(`[Extract] Image file detected (${ext}). Invoking OCR...`);
    text = await performOcrOnImage(fileBuffer, mimeType || `image/${ext}`);
  }
  // 5. PDF (Direct Text Extraction first, fallback to OCR only if scanned)
  else if (ext === "pdf" || mimeType === "application/pdf") {
    try {
      if (typeof globalThis !== "undefined" && !(globalThis as any).DOMMatrix) {
        (globalThis as any).DOMMatrix = class DOMMatrix {};
      }
      const pdfParse = require("pdf-parse");
      const pdfData = await pdfParse(fileBuffer);
      const pdfText = (pdfData?.text || "").trim();
      if (pdfText && pdfText.length >= 50) {
        text = pdfText;
        needsOcr = false;
      } else {
        needsOcr = true;
        console.log(`[Extract] Scanned PDF detected (text < 50 chars). Invoking OCR...`);
        text = await performOcrOnPdf(fileBuffer);
      }
    } catch (pdfErr: any) {
      console.warn("[Extract] Direct PDF parsing failed, falling back to OCR:", pdfErr?.message || pdfErr);
      needsOcr = true;
      text = await performOcrOnPdf(fileBuffer);
    }
  }
  // Fallback
  else {
    text = decodeTextBuffer(fileBuffer);
  }

  const elapsed = Date.now() - startTime;
  console.log(
    `[Extract] Complete | File: ${fileName} | Type: ${ext} | Method: ${
      needsOcr ? "OCR (Gemini AI)" : "Direct Extraction (0 AI Cost)"
    } | Length: ${text.length} chars | Elapsed: ${elapsed}ms`
  );

  return {
    fileHash,
    fileName,
    fileType: ext || "unknown",
    text,
    needsOcr,
    isCached: false,
    extractionTimeMs: elapsed,
  };
}
