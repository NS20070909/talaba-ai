import { NextResponse } from "next/server";
import libre from "libreoffice-convert";
import { promisify } from "util";
import { sendFileToTelegram } from "@/app/api/telegram/route";

const convertAsync = promisify(
  libre.convert
);

export async function POST(
  request: Request
) {
  console.log("[DIAGNOSTICS] 1. Request received");
  try {
    const formData =
      await request.formData();

    const file = formData.get(
      "file"
    ) as File | null;

    if (file) {
      console.log("[DIAGNOSTICS] 2. File name:", file.name);
      console.log("[DIAGNOSTICS] 3. File size:", file.size);
    }

    const userId =
      formData.get(
        "telegram_user_id"
      ) as string | null;


    const sendToTelegram =
      formData.get(
        "send_to_telegram"
      ) === "true";

    if (!file) {
      console.log("PPTX ERROR: file missing");
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

    // LibreOffice path — not available on Vercel serverless
    const sofficePath = process.env.SOFFICE_PATH || "/usr/bin/soffice";
    process.env.SOFFICE_PATH = sofficePath;

    const { existsSync } = require("fs") as typeof import("fs");
    const hasSoffice = existsSync(sofficePath);
    console.log("[DIAGNOSTICS] 5. hasSoffice result:", hasSoffice);

    console.log("[DIAGNOSTICS] before await file.arrayBuffer()");
    const bytes =
      await file.arrayBuffer();
    console.log("[DIAGNOSTICS] after await file.arrayBuffer()");

    console.log("[DIAGNOSTICS] before Buffer.from()");
    const buffer =
      Buffer.from(bytes);
    console.log("[DIAGNOSTICS] after Buffer.from()");

    let pdfBuffer: Buffer;

    if (hasSoffice) {
      console.log("[DIAGNOSTICS] before await convertAsync()");
      // PPTX → PDF
      pdfBuffer =
        await convertAsync(
          buffer,
          ".pdf",
          undefined
        );
      console.log("[DIAGNOSTICS] after await convertAsync()");
    } else {
      console.log("[DIAGNOSTICS] A. entering CloudConvert branch");
      console.log("[DIAGNOSTICS] B. CLOUDCONVERT_API_KEY exists?", !!process.env.CLOUDCONVERT_API_KEY);
      if (process.env.CLOUDCONVERT_API_KEY) {
        console.log("[DIAGNOSTICS] 6. CloudConvert fallback start");
        console.log("[DIAGNOSTICS] C. importing cloudconvert helper");
        const { convertWithCloudConvert } = await import("@/lib/cloudconvert");
        console.log("[DIAGNOSTICS] D. before convertWithCloudConvert()");
        pdfBuffer = await convertWithCloudConvert(buffer, file.name, "pptx", "pdf");
        console.log("[DIAGNOSTICS] E. after convertWithCloudConvert()");
      } else {
        console.log("[DIAGNOSTICS] before return 503");
        return NextResponse.json(
          {
            error:
              "PPTX → PDF Vercelda qo'llab-quvvatlanmaydi. Iltimos CloudConvert API kalitini o'rnating yoki Railwaydan foydalaning.",
          },
          { status: 503 }
        );
      }
    }

    const fileName =
      file.name.replace(
        ".pptx",
        ".pdf"
      );

    // TELEGRAMGA YUBORISH
    if (
      sendToTelegram &&
      userId
    ) {
      await sendFileToTelegram(
        Number(userId),
        pdfBuffer,
        fileName
      );


      return NextResponse.json({
        success: true,
      });
    }


    // BROWSER DOWNLOAD
    return new Response(
      new Uint8Array(
        pdfBuffer
      ),
      {
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${fileName}"`,
        },
      }
    );
  } catch (error: any) {
    console.log("[DIAGNOSTICS] F. caught error.message:", error?.message);
    console.log("[DIAGNOSTICS] G. caught error.stack:", error?.stack);
    console.error(
      "PPTX to PDF error:",
      error
    );
    console.error("[DIAGNOSTICS] 10. Full error.stack:", error?.stack || error);

    return NextResponse.json(
      {
        error:
          "Convert qilishda xatolik",
        details: error?.message || "Noma'lum xatolik",
      },
      {
        status: 500,
      }
    );
  }
}