import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { sendFileToTelegram } from "@/app/api/telegram/route";

export async function POST(
  req: Request
) {
  try {
    const {
      userId,
      subjects,
      gpa,
    } = await req.json();

    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Telegram user topilmadi",
        },
        {
          status: 400,
        }
      );
    }

    const doc =
      new PDFDocument({
        margin: 50,
      });

    const buffers: Buffer[] =
      [];

    doc.on(
      "data",
      (
        chunk: Buffer
      ) => {
        buffers.push(
          chunk
        );
      }
    );

    const pdfPromise =
      new Promise<Buffer>(
        (
          resolve
        ) => {
          doc.on(
            "end",
            () => {
              resolve(
                Buffer.concat(
                  buffers
                )
              );
            }
          );
        }
      );

    // HEADER
    doc
      .fontSize(24)
      .text(
        "Talaba AI",
        {
          align:
            "center",
        }
      );

    doc
      .fontSize(18)
      .text(
        "GPA Hisobot",
        {
          align:
            "center",
        }
      );

    doc.moveDown();

    doc
      .fontSize(14)
      .text(
        `GPA Natijasi: ${gpa.toFixed(
          2
        )} / 5`
      );

    doc.text(
      `Sana: ${new Date().toLocaleDateString(
        "uz-UZ"
      )}`
    );

    doc.moveDown();

    // TABLE HEADER
    doc
      .fontSize(16)
      .text(
        "Fanlar ro'yxati"
      );

    doc.moveDown(
      0.5
    );

    subjects.forEach(
      (
        subject: any,
        index: number
      ) => {
        doc
          .fontSize(12)
          .text(
            `${index + 1}. ${
              subject.name ||
              "Fan"
            }`
          );

        doc.text(
          `Kredit: ${
            subject.credit
          }`
        );

        doc.text(
          `Ball: ${
            subject.score
          }`
        );

        doc.moveDown(
          0.5
        );
      }
    );

    doc.end();

    const pdfBuffer =
      await pdfPromise;

    // TELEGRAMGA YUBORISH
    await sendFileToTelegram(
      Number(userId),
      pdfBuffer,
      "GPA-Hisobot.pdf"
    );

    return NextResponse.json(
      {
        success: true,
      }
    );
  } catch (error) {
    console.error(
      "GPA PDF error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "PDF yuborishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}