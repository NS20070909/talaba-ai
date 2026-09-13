import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEXT_MODEL = "gemini-3.8-flash";

const SYSTEM_INSTRUCTION = `Siz Talaba AI ning foydali o'quv yordamchisisiz. Asosan o'zbek tilida, foydalanuvchi qaysi tilda yozsa shu tilda javob bering. Javoblarni aniq, sodda va amaliy qiling. Dars, imtihon yoki vazifa savollarida bosqichma-bosqich tushuntiring. Bilmagan narsangizni to'qib chiqarmang.`;

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.text === "string" &&
    message.text.trim().length > 0
  );
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.gemini_ai_chat;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI Chat kaliti sozlanmagan." },
        { status: 500 },
      );
    }

    const body: { messages?: unknown } = await request.json();
    const rawMessages: unknown[] = Array.isArray(body.messages) ? body.messages : [];
    const messages = rawMessages.filter(isChatMessage).slice(-16);

    if (messages.length === 0) {
      return NextResponse.json({ error: "Xabar yuborilmadi." }, { status: 400 });
    }

    if (messages.some((message) => message.text.length > 4_000)) {
      return NextResponse.json(
        { error: "Har bir xabar 4 000 belgidan oshmasligi kerak." },
        { status: 400 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.text.trim() }],
      })),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.6,
        maxOutputTokens: 2_048,
      },
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error("Gemini bo'sh javob qaytardi.");
    }

    return NextResponse.json({ text, model: TEXT_MODEL });
  } catch (error) {
    console.error("[AI Chat] Text generation failed:", error);
    return NextResponse.json(
      { error: "AI hozircha javob bera olmadi. Qayta urinib ko'ring." },
      { status: 502 },
    );
  }
}
