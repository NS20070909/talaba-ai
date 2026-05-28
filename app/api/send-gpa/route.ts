import { NextResponse } from "next/server";
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

    let report =
      "🎓 TALABA AI GPA HISOBOT\n\n";

    report +=
      `📊 GPA: ${Number(
        gpa
      ).toFixed(
        2
      )} / 5\n\n`;

    report +=
      "📚 Fanlar:\n\n";

    subjects.forEach(
      (
        subject: any,
        index: number
      ) => {
        report += `${
          index + 1
        }. ${
          subject.name ||
          "Fan"
        }\n`;

        report += `Kredit: ${
          subject.credit
        }\n`;

        report += `Ball: ${
          subject.score
        }\n`;

        report += `Baho: ${
          subject.grade ||
          "-"
        }\n\n`;
      }
    );

    const fileBuffer =
      Buffer.from(
        report,
        "utf-8"
      );

    await sendFileToTelegram(
      Number(userId),
      fileBuffer,
      "GPA-Hisobot.txt"
    );

    return NextResponse.json(
      {
        success: true,
      }
    );
  } catch (error) {
    console.error(
      "SEND GPA ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Hisobot yuborishda xatolik",
      },
      {
        status: 500,
      }
    );
  }
}