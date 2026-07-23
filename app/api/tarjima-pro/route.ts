export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { getUser } from "@/lib/storage";
import type { PlanType } from "@/lib/user";
import type { LangCode } from "@/lib/tarjima-pro";
import {
  translateDocxFile,
  translatePdfFile,
  translateText,
} from "@/lib/tarjima-pro";
import {
  canUseTarjimaPro,
  incrementTarjimaPro,
} from "@/lib/tarjima-pro/usage";

const VALID_LANGS: LangCode[] = ["uz", "en", "ru"];

function parseLang(value: string | null): LangCode | null {
  if (!value || !VALID_LANGS.includes(value as LangCode)) return null;
  return value as LangCode;
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let telegramId: number;
    let sourceLang: LangCode;
    let targetLang: LangCode;
    let academic = false;
    let file: File | null = null;
    let text: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      telegramId = Number(formData.get("telegram_user_id"));
      sourceLang = parseLang(formData.get("source_lang") as string) || "uz";
      targetLang = parseLang(formData.get("target_lang") as string) || "en";
      academic = formData.get("academic") === "true";
      file = formData.get("file") as File | null;
    } else {
      const body = await request.json();
      telegramId = Number(body.telegram_user_id);
      sourceLang = parseLang(body.source_lang) || "uz";
      targetLang = parseLang(body.target_lang) || "en";
      academic = body.academic === true;
      text = typeof body.text === "string" ? body.text : null;
    }

    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "telegram_user_id is required" },
        { status: 400 }
      );
    }

    if (sourceLang === targetLang) {
      return NextResponse.json(
        { success: false, error: "Manba va maqsad tillar bir xil bo'lmasligi kerak" },
        { status: 400 }
      );
    }

    const limitCheck = await canUseTarjimaPro(telegramId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: limitCheck.banned ? "BANNED" : "LIMIT_REACHED",
          error: limitCheck.banned
            ? "🚫 Siz bloklangansiz"
            : "Bugungi tarjima limiti tugagan. Ertaga qayting yoki tarifni yangilang.",
        },
        { status: 403 }
      );
    }

    const user = await getUser(telegramId);
    const plan: PlanType = user?.plan ?? "FREE";

    let result;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const lower = file.name.toLowerCase();

      if (lower.endsWith(".docx")) {
        result = await translateDocxFile(
          buffer,
          file.name,
          sourceLang,
          targetLang,
          academic,
          plan
        );
      } else if (lower.endsWith(".pdf")) {
        result = await translatePdfFile(
          buffer,
          file.name,
          sourceLang,
          targetLang,
          academic,
          plan
        );
      } else {
        return NextResponse.json(
          { success: false, error: "Faqat .docx yoki .pdf fayllar qabul qilinadi" },
          { status: 400 }
        );
      }
    } else if (text) {
      result = await translateText(text, sourceLang, targetLang, academic, plan);
    } else {
      return NextResponse.json(
        { success: false, error: "Matn yoki fayl kerak" },
        { status: 400 }
      );
    }

    await incrementTarjimaPro(telegramId);

    return NextResponse.json({
      success: true,
      translatedText: result.translatedText,
      fileName: result.outputFileName,
      fileBase64: result.buffer?.toString("base64"),
      pdfFileName: result.pdfFileName,
      pdfBase64: result.pdfBuffer?.toString("base64"),
      meta: result.meta,
    });
  } catch (error: unknown) {
    console.error("[tarjima-pro] Error:", error);
    const message =
      error instanceof Error ? error.message : "Tarjimada xatolik yuz berdi";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
