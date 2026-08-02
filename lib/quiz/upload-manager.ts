import mammoth from "mammoth";
import { performOcrOnImage, performOcrOnPdf } from "./ocr-adapter";
import { calculateFileHash, getCachedQuizByHash, saveQuizToCache } from "./cache";
import { QuizQuestion } from "./types";

export interface ExtractedFileContent {
  fileHash: string;
  fileName: string;
  fileType: string;
  text: string;
  needsOcr: boolean;
  isCached?: boolean;
  cachedQuestions?: QuizQuestion[];
}

export async function extractTextFromFile(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<ExtractedFileContent> {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const fileHash = calculateFileHash(fileBuffer);

  // Check SHA-256 fingerprint cache first
  const cached = await getCachedQuizByHash(fileHash);
  if (cached && cached.rawText) {
    return {
      fileHash,
      fileName,
      fileType: ext,
      text: cached.rawText,
      needsOcr: false,
      isCached: true,
      cachedQuestions: cached.questions,
    };
  }

  let text = "";
  let needsOcr = false;

  // 1. Plain Text / CSV
  if (ext === "txt" || ext === "csv" || mimeType?.includes("text/plain") || mimeType?.includes("text/csv")) {
    text = fileBuffer.toString("utf-8").trim();
  }
  // 2. DOCX / DOC
  else if (ext === "docx" || ext === "doc" || mimeType?.includes("wordprocessingml") || mimeType?.includes("msword")) {
    try {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      text = result.value ? result.value.trim() : "";
    } catch (err) {
      console.warn("DOCX mammoth extraction failed, falling back to string text:", err);
    }
    if (!text || text.length < 30) {
      text = fileBuffer.toString("utf-8").replace(/[^\x20-\x7E\s\u0400-\u04FF]/g, " ").trim();
    }
  }
  // 3. XLS / XLSX
  else if (ext === "xlsx" || ext === "xls" || mimeType?.includes("spreadsheet")) {
    text = fileBuffer
      .toString("utf-8")
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\x20-\x7E\s\u0400-\u04FF\t\n]/g, " ")
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");
  }
  // 4. Images (JPG, JPEG, PNG, WEBP, HEIC)
  else if (["jpg", "jpeg", "png", "webp", "heic"].includes(ext) || mimeType?.startsWith("image/")) {
    needsOcr = true;
    text = await performOcrOnImage(fileBuffer, mimeType || `image/${ext}`);
  }
  // 5. PDF (Try text extraction or OCR via Gemini)
  else if (ext === "pdf" || mimeType === "application/pdf") {
    needsOcr = true;
    text = await performOcrOnPdf(fileBuffer);
  }
  // Fallback
  else {
    text = fileBuffer.toString("utf-8").trim();
  }

  return {
    fileHash,
    fileName,
    fileType: ext || "unknown",
    text,
    needsOcr,
    isCached: false,
  };
}
