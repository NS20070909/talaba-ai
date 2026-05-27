import { NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import { sendFileToTelegram } from "@/app/api/telegram/route";

export async function POST(
  req: Request
) {
  try {
    const {
      text,
      telegram_user_id,
      send_to_telegram,
    } = await req.json();

    if (!text) {
      return NextResponse.json(
        {
          error:
            "Matn topilmadi",
        },
        { status: 400 }
      );
    }

    // FAN NOMI
    const fanMatch =
      text.match(
        /📚\s*Fan:\s*(.*)/i
      );

    const fan =
      fanMatch?.[1]
        ?.trim() ||
      "Topilmadi";

    // BILET RAQAMI
    const biletMatch =
      text.match(
        /🎫\s*Bilet:\s*(.*)/i
      );

    const bilet =
      biletMatch?.[1]
        ?.trim() ||
      "Topilmadi";

    // AI ichidagi takrorlarni olib tashlash
    let cleanText =
      text
        .replace(
          /📚\s*Fan:.*(\n|$)/gi,
          ""
        )
        .replace(
          /🎫\s*Bilet:.*(\n|$)/gi,
          ""
        )
        .trim();

    // Har savol yangi qatordan boshlansin
    cleanText =
      cleanText.replace(
        /(\d+-savol)/g,
        "\n\n$1"
      );

    // Qatorlarga ajratish
    const lines:
      string[] =
      cleanText
        .split("\n")
        .filter(
          (
            line: string
          ) =>
            line.trim() !==
            ""
        );

    // Word paragraph
    const paragraphs =
      lines.map(
        (
          line: string
        ) =>
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 28,
              }),
            ],

            spacing: {
              after: 140,
            },
          })
      );

    // DOCUMENT
    const doc =
      new Document({
        sections: [
          {
            children: [
              // TITLE
              new Paragraph({
                text:
                  fan !==
                  "Topilmadi"
                    ? `${fan} — Talaba AI`
                    : "Talaba AI",

                heading:
                  HeadingLevel.HEADING_1,

                spacing: {
                  after: 250,
                },
              }),

              // FAN
              new Paragraph({
                children: [
                  new TextRun({
                    text: `📚 Fan: ${fan}`,
                    bold: true,
                  }),
                ],

                spacing: {
                  after: 120,
                },
              }),

              // BILET
              new Paragraph({
                children: [
                  new TextRun({
                    text: `🎫 Bilet: ${bilet}`,
                    bold: true,
                  }),
                ],

                spacing: {
                  after: 120,
                },
              }),

              // DATE
              new Paragraph({
                text: `📅 Sana: ${new Date().toLocaleDateString(
                  "uz-UZ"
                )}`,

                spacing: {
                  after: 250,
                },
              }),

              // TEXT
              ...paragraphs,
            ],
          },
        ],
      });

    const buffer =
      await Packer.toBuffer(
        doc
      );

    const fileName =
      "TalabaAI-Shpargalka.docx";

    // TELEGRAMGA YUBORISH
    if (
      send_to_telegram &&
      telegram_user_id
    ) {
      await sendFileToTelegram(
        Number(
          telegram_user_id
        ),
        Buffer.from(buffer),
        fileName
      );

      return NextResponse.json({
        success: true,
      });
    }

    // DOWNLOAD
    return new NextResponse(
      new Uint8Array(
        buffer
      ),
      {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,
        },
      }
    );
  } catch (error) {
    console.log(
      "WORD ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Word yaratishda xatolik",
      },
      { status: 500 }
    );
  }
}