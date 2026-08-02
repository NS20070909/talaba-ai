import { runQuizModelChain } from "./models";

export async function performOcrOnImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const base64 = imageBuffer.toString("base64");

  const prompt = `
Extract ALL test/quiz questions, options, and correct answer markers from this image using OCR.
Do not skip any text. Preserve numbering (1, 2, 3...) and options (A, B, C, D or 1, 2, 3, 4).
If correct answers are marked with +, *, underline, or bold, preserve that exact marker.
Return ONLY the raw extracted text without conversational intros.
`;

  return await runQuizModelChain([
    {
      role: "user",
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: mimeType || "image/jpeg",
            data: base64,
          },
        },
      ],
    },
  ]);
}

export async function performOcrOnPdf(pdfBuffer: Buffer): Promise<string> {
  const base64 = pdfBuffer.toString("base64");

  const prompt = `
Extract ALL quiz/test questions, options, and answer keys from this PDF document.
Preserve all question numbering, options (A, B, C, D), and any marked correct answers (+, *, bold).
Do not summarize. Return ONLY the complete text of all questions and options.
`;

  return await runQuizModelChain([
    {
      role: "user",
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64,
          },
        },
      ],
    },
  ]);
}
