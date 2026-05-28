import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { Telegraf, Input } from "telegraf";

const bot = new Telegraf(
  process.env.TELEGRAM_BOT_TOKEN!
);

export async function POST(
  req: Request
) {
  try {
    const {
      userId,
      subjects,
      gpa,
    } = await req.json();

    const doc =
      new PDFDocument();

    const buffers: Buffer[] =
      [];

    doc.on(
      "data",
      buffers.push.bind(
        buffers
      )
    );

    doc.on("end", async () => {
      const pdfBuffer =
        Buffer.concat(
          buffers
        );

      await bot.telegram.sendDocument(
        userId,
        Input.fromBuffer(
          pdfBuffer,
          "GPA-Hisobot.pdf"
        ),
        {
          caption:
            "📄 GPA hisobot tayyor",
        }
      );
    });

    doc
      .fontSize(22)
      .text(
        "Talaba AI - GPA Hisobot"
      );

    doc.moveDown();

    doc
      .fontSize(14)
      .text(
        `GPA: ${gpa.toFixed(
          2
        )} / 5`
      );

    doc.moveDown();

    doc
      .fontSize(16)
      .text("Fanlar:");

    subjects.forEach(
      (
        subject: any,
        index: number
      ) => {
        doc.text(
          `${index + 1}. ${
            subject.name
          } | Kredit: ${
            subject.credit
          } | Ball: ${
            subject.score
          }`
        );
      }
    );

    doc.end();

    return NextResponse.json(
      {
        success: true,
      }
    );
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      {
        error:
          "PDF send error",
      },
      {
        status: 500,
      }
    );
  }
}