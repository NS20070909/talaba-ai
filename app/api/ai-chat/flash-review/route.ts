import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { canUseFlashReview, incrementFlashReview } from "@/lib/limit-checker";

export const runtime = "nodejs";
export const maxDuration = 60;

const SCRIPT_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-3.1-flash-lite-preview",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
];

const TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
];
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // AudioFormat 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI kaliti sozlanmagan." },
        { status: 500 },
      );
    }

    const { text, topic, telegram_id } = await request.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Tushuntirish uchun matn yuborilmadi." },
        { status: 400 },
      );
    }

    // Quota verification & strict authorization
    const userId = Number(telegram_id);
    if (!userId || isNaN(userId) || userId <= 0) {
      return NextResponse.json(
        { error: "Avtorizatsiyadan o'ting yoki Telegram orqali kiring." },
        { status: 401 },
      );
    }

    const flashCheck = await canUseFlashReview(userId);
    if (flashCheck.banned) {
      return NextResponse.json(
        { error: "Profilingiz bloklangan.", banned: true },
        { status: 403 },
      );
    }
    if (!flashCheck.allowed) {
      return NextResponse.json(
        {
          error: `Bugungi Flash Review limitingiz (${flashCheck.limit} ta audio) tugagan. Ko'proq audio tinglash uchun Premium tarifga o'ting.`,
          limitReached: true,
          limit: flashCheck.limit,
          remaining: 0,
        },
        { status: 403 },
      );
    }
    let remainingReviews = flashCheck.remaining;

    const ai = new GoogleGenAI({ apiKey });

    // 1. Generate a concise 40-60 second audio-ready summary script (timeout 10s)
    const scriptPrompt = `Quyidagi o'quv mavzusi yoki tushuntirish asosida, talaba uchun 40-60 soniyada tinglashga mo'ljallangan, juda qiziqarli, lo'nda va tushunarli Flash Review audio skriptini yozing.
Mavzu/Matn: "${topic ? topic + ": " : ""}${text.slice(0, 1000)}"

Qoidalar:
- Skript taxminan 60-90 so'zdan iborat bo'lsin (40-60 soniya nutq).
- FAQAT o'qiladigan matnni bering (hech qanday [Musiqa], [Kirish] yoki sahna ko'rsatmasisiz).
- Eng muhim qoida yoki mohiyatni esda qolarli tarzda ayting.`;
    // 1. Generate script with fallback models
    let script = "";
    let lastScriptError: any = null;

    for (const model of SCRIPT_MODELS) {
      try {
        console.log(`[Flash Review] Trying script model: ${model}`);

        const scriptPromise = ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [{ text: scriptPrompt }],
            },
          ],
          config: {
            temperature: 0.4,
            maxOutputTokens: 300,
          },
        });

        const scriptRes = await Promise.race([
          scriptPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Skript yaratish vaqti tugadi")),
              12000
            )
          ),
        ]);

        const generated = scriptRes.text?.trim() || "";

        if (generated) {
          script = generated;

          console.log(
            `[Flash Review] Script success: ${model}`
          );

          break;
        }
      } catch (err: any) {
        lastScriptError = err;

        console.warn(
          `[Flash Review] Script model ${model} failed, trying fallback:`,
          err?.status,
          err?.message
        );
      }
    }

    if (!script) {
      throw (
        lastScriptError ||
        new Error("Flash Review skriptini yaratib bo'lmadi.")
      );
    }

       // 2. Generate Native Audio via Gemini TTS with fallback
    let audioBase64: string | null = null;
    let lastTtsError: any = null;

    for (const ttsModel of TTS_MODELS) {
      try {
        console.log(`[Flash Review] Trying TTS model: ${ttsModel}`);

        const audioPromise = ai.models.generateContent({
          model: ttsModel,
          contents: [
            {
              role: "user",
              parts: [{ text: script }],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Puck",
                },
              },
            },
          },
        });

        const audioRes = await Promise.race([
          audioPromise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Audio sintezlash vaqti tugadi")),
              18000
            )
          ),
        ]);

        const part =
          audioRes.candidates?.[0]?.content?.parts?.[0];

        if (part?.inlineData?.data) {
          audioBase64 = part.inlineData.data;

          console.log(
            `[Flash Review] TTS success: ${ttsModel}`
          );

          break;
        }

        throw new Error(`${ttsModel} audio qaytarmadi.`);
      } catch (err: any) {
        lastTtsError = err;

        console.warn(
          `[Flash Review] TTS model ${ttsModel} failed, trying fallback:`,
          err?.status,
          err?.message
        );
      }
    }

    if (!audioBase64) {
      throw (
        lastTtsError ||
        new Error("Ovozli audio generatsiya qilib bo'lmadi.")
      );
    }
   

    // 3. Convert raw PCM 24000Hz to standard playable WAV
    const pcmBuffer = Buffer.from(audioBase64, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
    const wavDataUrl = `data:audio/wav;base64,${wavBuffer.toString("base64")}`;

    // Calculate approximate duration
    const totalSeconds = Math.round(pcmBuffer.length / (24000 * 2));

    if (userId && !isNaN(userId)) {
      incrementFlashReview(userId).catch((err) => {
        console.warn("[Flash Review] Failed to increment usage count:", err);
      });
      if (remainingReviews !== undefined) {
        remainingReviews = Math.max(0, remainingReviews - 1);
      }
    }

    return NextResponse.json({
      success: true,
      audioUrl: wavDataUrl,
      script,
      durationSeconds: totalSeconds,
      remaining: remainingReviews,
    });
  } catch (error: any) {
    console.error("[Flash Review Error]:", error?.message || error);
    const isTimeout = error?.message?.includes("vaqti tugadi") || error?.name === "TimeoutError";
    const isQuota = error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED");

    if (isQuota) {
      return NextResponse.json(
        { error: "🔊 Hozir audio yaratish xizmati band. Bir ozdan keyin qayta urinib ko'ring." },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: isTimeout
          ? "Audio tayyorlash vaqti tugadi. Iltimos, qayta urinib ko'ring."
          : (error?.message || "Flash Review audio yaratishda xatolik yuz berdi."),
      },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
