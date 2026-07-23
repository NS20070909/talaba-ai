export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextResponse } from "next/server";
import { bot } from "@/lib/bot";
import { Input } from "telegraf";
import { cleanDocument } from "@/lib/hujjat-tozalash";
import { getUser } from "@/lib/storage";
import type { PlanType } from "@/lib/user";
import {
  canUseHujjatTozalash,
  incrementHujjatTozalash,
} from "@/lib/hujjat-tozalash/usage";

type DeliveryMode = "download" | "telegram" | "both";

function buildTelegramCaption(report: Awaited<ReturnType<typeof cleanDocument>>["report"]): string {
  const before = report.beforeScore.overall;
  const after = report.afterScore.overall;
  const fixes = report.fixes.totalIssuesFixed;

  return (
    `✅ <b>Hujjat tozalandi</b>\n\n` +
    `📊 Sifat: ${before} → ${after}\n` +
    `🔧 Tuzatilgan: ${fixes} ta muammo\n` +
    `📄 ${report.pageCount} bet · ${report.wordCount} so'z\n\n` +
    `Tozalangan hujjat biriktirilgan.`
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("telegram_user_id") as string | null;
    const deliveryRaw = (formData.get("delivery") as string) || "download";
    const legacyTelegram = formData.get("send_to_telegram") === "true";

    let delivery: DeliveryMode = "download";
    if (deliveryRaw === "telegram" || deliveryRaw === "both") delivery = deliveryRaw;
    else if (legacyTelegram) delivery = "telegram";

    const telegramId = Number(userId);
    if (!telegramId || isNaN(telegramId)) {
      return NextResponse.json(
        { success: false, error: "telegram_user_id is required" },
        { status: 400 }
      );
    }

    const limitCheck = await canUseHujjatTozalash(telegramId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: limitCheck.banned ? "BANNED" : "LIMIT_REACHED",
          error: limitCheck.banned
            ? "🚫 Siz bloklangansiz"
            : "Bugungi hujjat tozalash limiti tugagan. Ertaga qayting yoki tarifni yangilang.",
        },
        { status: 403 }
      );
    }

    if (!file) {
      return NextResponse.json({ success: false, error: "Fayl topilmadi" }, { status: 400 });
    }

    const user = await getUser(telegramId);
    const plan: PlanType = user?.plan ?? "FREE";
    const inputBuffer = Buffer.from(await file.arrayBuffer());

    const result = await cleanDocument(
      inputBuffer,
      file.name,
      file.type,
      plan
    );

    if (delivery === "telegram" || delivery === "both") {
      await bot.telegram.sendDocument(
        telegramId,
        Input.fromBuffer(result.buffer, result.outputFileName),
        { caption: buildTelegramCaption(result.report), parse_mode: "HTML" }
      );
    }

    await incrementHujjatTozalash(telegramId);

    const reportPayload = {
      beforeScore: result.report.beforeScore,
      afterScore: result.report.afterScore,
      fixes: result.report.fixes,
      grammarSuggestions: result.report.grammarSuggestions.slice(0, 10),
      warnings: result.report.warnings,
      recommendations: result.report.aiAnalysis.recommendations.slice(0, 8),
      issues: result.report.aiAnalysis.issues.slice(0, 8),
      duplicates: result.report.aiAnalysis.duplicates.slice(0, 5),
      pageCount: result.report.pageCount,
      paragraphCount: result.report.paragraphCount,
      wordCount: result.report.wordCount,
      processingTimeMs: result.report.processingTimeMs,
    };

    if (delivery === "telegram") {
      return NextResponse.json({
        success: true,
        fileName: result.outputFileName,
        telegramSent: true,
        report: reportPayload,
      });
    }

    return NextResponse.json({
      success: true,
      fileName: result.outputFileName,
      fileBase64: result.buffer.toString("base64"),
      report: reportPayload,
      telegramSent: delivery === "both",
    });
  } catch (error: unknown) {
    console.error("[hujjat-tozalash] Error:", error);
    const message =
      error instanceof Error ? error.message : "Hujjat tozalashda xatolik yuz berdi";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
