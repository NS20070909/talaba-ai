import { GoogleGenAI, Modality } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LIVE_MODEL = "gemini-3.1-flash-live-preview";

const SYSTEM_INSTRUCTION = `Siz Talaba AI ning jonli ovozli o'quv yordamchisisiz. Asosan o'zbek tilida, foydalanuvchi qaysi tilda gapirsa shu tilda gapiring. Javoblarni qisqa, aniq va suhbatga tabiiy tarzda mos bering. Dars yoki imtihon mavzusini sodda tushuntiring.`;

export async function POST() {
  try {
    const apiKey = process.env.gemini_ai_chat;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI Chat kaliti sozlanmagan." },
        { status: 500 },
      );
    }

    const now = Date.now();
    const ai = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(now + 60_000).toISOString(),
        expireTime: new Date(now + 25 * 60_000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        },
      },
    });

    if (!token.name) {
      throw new Error("Gemini Live token qaytarmadi.");
    }

    return NextResponse.json({ token: token.name, model: LIVE_MODEL });
  } catch (error) {
    console.error("[AI Chat] Live token creation failed:", error);
    return NextResponse.json(
      { error: "Ovozli suhbatni ishga tushirib bo'lmadi." },
      { status: 502 },
    );
  }
}
