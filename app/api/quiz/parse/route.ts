import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/quiz/upload-manager";
import { parseQuizHybrid } from "@/lib/quiz/hybrid-parser";
import { canUseQuiz } from "@/lib/limit-checker";
import { saveQuizToCache } from "@/lib/quiz/cache";
import { saveUserSession } from "@/lib/quiz/session-manager";
import { sanitizeFilename, sanitizeErrorMessage } from "@/lib/quiz/security";

export const maxDuration = 60;

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    let telegramId: number | undefined = undefined;
    let rawText = "";
    let fileName = "";
    let fileBuffer: Buffer | null = null;
    let mimeType = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      telegramId = Number(formData.get("telegram_id"));
      rawText = (formData.get("text") as string) || "";
      const file = formData.get("file") as File | null;

      if (file) {
        fileName = sanitizeFilename(file.name);
        mimeType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      const json = await req.json();
      telegramId = Number(json.telegram_id);
      rawText = json.text || "";
      fileName = sanitizeFilename(json.file_name || "");
    }

    if (telegramId && !isNaN(telegramId)) {
      const limitCheck = await canUseQuiz(telegramId);
      if (!limitCheck.allowed) {
        console.warn(`[Quiz Parse API] User ${telegramId} limit reached.`);
        return NextResponse.json(
          {
            success: false,
            error: "LIMIT_REACHED",
            message: "Kunlik Quiz yaratish limiti tugagan. Premium rejasiga o'ting!",
          },
          { status: 403 }
        );
      }
    }

    let extractedText = rawText;
    let fileHash = "";

    if (fileBuffer) {
      const extStartTime = Date.now();
      const extracted = await extractTextFromFile(fileBuffer, fileName, mimeType);
      extractedText = extracted.text;
      fileHash = extracted.fileHash;

      // Release buffer immediately
      fileBuffer = null;
      console.log(`[Quiz Parse API Stage] File Extraction completed in ${Date.now() - extStartTime}ms`);

      if (extracted.isCached && extracted.cachedQuestions?.length) {
        const cachedResult = {
          title: fileName ? fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") : "Quiz",
          sourceFileName: fileName,
          rawText: extractedText,
          questions: extracted.cachedQuestions,
          overallValidation: {
            totalQuestions: extracted.cachedQuestions.length,
            validQuestions: extracted.cachedQuestions.length,
            flawedQuestions: 0,
            issues: [],
          },
          parserMethod: "RULE" as const,
        };

        if (telegramId) {
          await saveUserSession({
            userId: telegramId,
            fileHash,
            fileName,
            step: "EDIT",
            rawText: extractedText,
            questions: extracted.cachedQuestions,
          }).catch((err) => console.error("Failed to save session:", err));
        }

        console.log(`[Quiz Parse API SHA-256 Cache Hit] Total API time: ${Date.now() - startTime}ms`);
        return NextResponse.json({
          success: true,
          isCached: true,
          result: cachedResult,
        });
      }
    }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "EMPTY_INPUT",
          message: "Fayl yoki matndan hech qanday kontent o'qib bo'lmadi.",
        },
        { status: 400 }
      );
    }

    const parsedResult = await parseQuizHybrid(extractedText, fileName);

    // Save to SHA-256 cache silently in background
    if (fileHash && parsedResult.questions.length > 0) {
      saveQuizToCache(
        fileHash,
        fileName || "Quiz",
        fileName.split(".").pop() || "txt",
        extractedText,
        parsedResult.questions
      ).catch((err) => console.error("Failed to save quiz cache:", err));
    }

    // Save to active user session in background
    if (telegramId && !isNaN(telegramId)) {
      saveUserSession({
        userId: telegramId,
        fileHash: fileHash || undefined,
        fileName: fileName || undefined,
        step: "EDIT",
        rawText: extractedText,
        questions: parsedResult.questions,
      }).catch((err) => console.error("Failed to save active session:", err));
    }

    const totalElapsed = Date.now() - startTime;
    console.log(`[Quiz Parse API Completed] Total Elapsed: ${totalElapsed}ms | Questions: ${parsedResult.questions.length}`);

    return NextResponse.json({
      success: true,
      isCached: false,
      result: parsedResult,
      elapsedMs: totalElapsed,
    });
  } catch (error: any) {
    const totalElapsed = Date.now() - startTime;
    console.error(`[Quiz Parse API Error] Failed after ${totalElapsed}ms:`, error);

    return NextResponse.json(
      {
        success: false,
        error: "PARSING_FAILED",
        message: sanitizeErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
