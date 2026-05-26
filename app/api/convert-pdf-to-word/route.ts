import { NextResponse } from "next/server";
import PDFParser from "pdf2json";
import {
  GoogleGenerativeAI,
} from "@google/generative-ai";

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

const genAI =
  new GoogleGenerativeAI(
    process.env
      .GEMINI_DOCUMENT_API_KEY!
  );

function extractTextFromPdf(
  buffer: Buffer
): Promise<string> {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const pdfParser =
        new PDFParser(
          undefined,
          true
        );

      // Error handler
      pdfParser.on(
        "pdfParser_dataError",
        (errData: any) => {
          reject(
            errData
          );
        }
      );

      // Success handler
      pdfParser.on(
        "pdfParser_dataReady",
        (pdfData: any) => {
          try {
            let text = "";

            pdfData.Pages.forEach(
              (
                page: any
              ) => {
                page.Texts.forEach(
                  (
                    textItem: any
                  ) => {
                    try {
                      text +=
                        decodeURIComponent(
                          textItem
                            ?.R?.[0]
                            ?.T ||
                            ""
                        ) + " ";
                    } catch {
                      text +=
                        textItem
                          ?.R?.[0]
                          ?.T ||
                        "";
                    }
                  }
                );

                text +=
                  "\n\n";
              }
            );

            resolve(
              text
            );
          } catch (err) {
            reject(
              err
            );
          }
        }
      );

      pdfParser.parseBuffer(
        buffer
      );
    }
  );
}

export async function POST(
  request: Request
) {
  try {
    const formData =
      await request.formData();

    const file =
      formData.get(
        "file"
      ) as
        | File
        | null;

    if (!file) {
      return NextResponse.json(
        {
          error:
            "Fayl topilmadi",
        },
        {
          status: 400,
        }
      );
    }

    // File → Buffer
    const bytes =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(
        bytes
      );

    // PDF text extract
    const extractedText =
      await extractTextFromPdf(
        buffer
      );

    if (
      !extractedText ||
      extractedText.trim()
        .length < 20
    ) {
      return NextResponse.json(
        {
          error:
            "PDF ichidan matn topilmadi",
        },
        {
          status: 400,
        }
      );
    }

    // Gemini
    const model =
      genAI.getGenerativeModel(
        {
          model:
            "gemini-2.5-flash",
        }
      );

    // AI formatting
    const result =
      await model.generateContent(`
Sen professional document formatter san.

PDF dan olingan matnni professional Word formatiga keltir.

Qoidalar:
- Headinglarni saqla
- Paragraflarni tartibla
- Keraksiz bo‘sh joylarni olib tashla
- Original ma'noni o‘zgartirma
- Markdown ishlatma
- Faqat clean text qaytar

TEXT:

${extractedText}
`);

    const cleanText =
      result.response
        .text()
        .trim();

    // Word paragraphs
    const paragraphs =
      cleanText
        .split(
          "\n"
        )
        .filter(
          (
            line
          ) =>
            line.trim()
        )
        .map(
          (
            line
          ) =>
            new Paragraph(
              {
                children:
                  [
                    new TextRun(
                      line
                    ),
                  ],
              }
            )
        );

    // DOCX create
    const doc =
      new Document({
        sections: [
          {
            children:
              paragraphs,
          },
        ],
      });

    const docxBuffer =
      await Packer.toBuffer(
        doc
      );

    // Download response
    return new Response(
      new Uint8Array(
        docxBuffer
      ),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

          "Content-Disposition":
            `attachment; filename="${file.name.replace(
              ".pdf",
              ".docx"
            )}"`,
        },
      }
    );
  } catch (error) {
    console.error(
      error
    );

    return NextResponse.json(
      {
        error:
          "PDF → Word da xatolik",
      },
      {
        status: 500,
      }
    );
  }
}