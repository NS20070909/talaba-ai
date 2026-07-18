import type { DocumentLimits } from "./types";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ENCRYPTED_MARKERS = [
  "EncryptedPackage",
  "encryption",
  "password",
  "protected",
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

export function validateFileMeta(
  fileName: string,
  fileSize: number,
  mimeType: string | undefined,
  limits: DocumentLimits
): ValidationResult {
  if (!fileName) {
    return { valid: false, error: "Fayl topilmadi", code: "NO_FILE" };
  }

  const lower = fileName.toLowerCase();

  if (!lower.endsWith(".docx")) {
    return {
      valid: false,
      error: "Faqat .docx formatdagi Word hujjatlar qabul qilinadi",
      code: "UNSUPPORTED_TYPE",
    };
  }

  const blocked = [".pdf", ".txt", ".pages", ".odt", ".zip", ".rar", ".exe"];
  if (blocked.some((ext) => lower.endsWith(ext))) {
    return {
      valid: false,
      error: "Bu fayl formati qo'llab-quvvatlanmaydi. Faqat .docx yuklang",
      code: "UNSUPPORTED_TYPE",
    };
  }

  if (mimeType && mimeType !== DOCX_MIME && !mimeType.includes("wordprocessingml")) {
    return {
      valid: false,
      error: "Noto'g'ri fayl turi. Faqat Word (.docx) hujjat yuklang",
      code: "INVALID_MIME",
    };
  }

  if (fileSize === 0) {
    return {
      valid: false,
      error: "Fayl bo'sh. Boshqa hujjat yuklang",
      code: "EMPTY_FILE",
    };
  }

  if (fileSize > limits.maxFileBytes) {
    const maxMb = Math.round(limits.maxFileBytes / (1024 * 1024));
    return {
      valid: false,
      error: limits.isPremium
        ? `Fayl hajmi ${maxMb} MB dan oshmasligi kerak`
        : `Fayl hajmi ${maxMb} MB dan oshmasligi kerak. Premium tarifda katta hujjatlar mumkin`,
      code: "FILE_TOO_LARGE",
    };
  }

  return { valid: true };
}

export function validateDocxBuffer(
  buffer: Buffer,
  limits: DocumentLimits,
  pageCount: number,
  textLength: number
): ValidationResult {
  if (!buffer || buffer.length < 100) {
    return {
      valid: false,
      error: "Hujjat buzilgan yoki o'qib bo'lmaydi",
      code: "CORRUPTED",
    };
  }

  const header = buffer.subarray(0, 4).toString("hex");
  if (header !== "504b0304" && header !== "504b0506") {
    return {
      valid: false,
      error: "Hujjat buzilgan. To'g'ri .docx fayl yuklang",
      code: "CORRUPTED",
    };
  }

  const bufferStr = buffer.toString("binary");
  if (ENCRYPTED_MARKERS.some((m) => bufferStr.includes(m))) {
    return {
      valid: false,
      error: "Parol himoyalangan hujjatlar qo'llab-quvvatlanmaydi",
      code: "PASSWORD_PROTECTED",
    };
  }

  if (textLength < 20) {
    return {
      valid: false,
      error: "Hujjat bo'sh yoki juda qisqa. Kamida bir necha jumla bo'lishi kerak",
      code: "EMPTY_DOCUMENT",
    };
  }

  if (pageCount > limits.maxPages) {
    return {
      valid: false,
      error: limits.isPremium
        ? `Hujjat ${limits.maxPages} betdan oshmasligi kerak`
        : `Hujjat ${limits.maxPages} betdan oshmasligi kerak. Premium tarifda katta hujjatlar mumkin`,
      code: "PAGE_LIMIT",
    };
  }

  return { valid: true };
}
