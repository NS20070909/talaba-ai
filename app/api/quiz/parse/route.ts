import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/quiz/upload-manager";
import { parseQuizHybrid } from "@/lib/quiz/hybrid-parser";
import { canUseQuiz } from "@/lib/limit-checker";
import { saveQuizToCache } from "@/lib/quiz/cache";
import { saveUserSession } from "@/lib/quiz/session-manager";

export const maxDuration = 60;

export async function POST(req: Request) {
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
        fileName = file.name;
        mimeType = file.type;
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      const json = await req.json();
      telegramId = Number(json.telegram_id);
      rawText = json.text || "";
      fileName = json.file_name || "";
    }

    if (telegramId && !isNaN(telegramId)) {
      const limitCheck = await canUseQuiz(telegramId);
      if (!limitCheck.allowed) {
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
      const extracted = await extractTextFromFile(fileBuffer, fileName, mimeType);
      extractedText = extracted.text;
      fileHash = extracted.fileHash;

      // Immediately release fileBuffer to prevent memory leaks
      fileBuffer = null;

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
          });
        }

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

    // Save to SHA-256 cache
    if (fileHash && parsedResult.questions.length > 0) {
      await saveQuizToCache(
        fileHash,
        fileName || "Quiz",
        fileName.split(".").pop() || "txt",
        extractedText,
        parsedResult.questions
      );
    }

    // Save to active user session for session resume
    if (telegramId && !isNaN(telegramId)) {
      await saveUserSession({
        userId: telegramId,
        fileHash: fileHash || undefined,
        fileName: fileName || undefined,
        step: "EDIT",
        rawText: extractedText,
        questions: parsedResult.questions,
      });
    }

    return NextResponse.json({
      success: true,
      isCached: false,
      result: parsedResult,
    });
  } catch (error: any) {
    console.error("Quiz Parse API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Quiz tahlil qilishda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
