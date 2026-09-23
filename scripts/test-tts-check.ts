import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("API key not found");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName: string) {
  console.log(`Testing model: ${modelName}...`);
  const t0 = Date.now();
  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: "user", parts: [{ text: "Salom, talaba! Bugun Pifagor teoremasini o'rganamiz." }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: "Puck"
            }
          }
        }
      }
    });
    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    const part = res.candidates?.[0]?.content?.parts?.[0];
    const dataLen = part?.inlineData?.data?.length || 0;
    console.log(`✅ ${modelName} SUCCEEDED in ${dur}s, audio length: ${dataLen} chars`);
    return true;
  } catch (err: any) {
    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`❌ ${modelName} FAILED in ${dur}s: status=${err?.status || err?.statusCode}, message=${err?.message}`);
    return false;
  }
}

async function run() {
  const models = [
    "gemini-2.5-flash-preview-tts",
    "gemini-2.5-pro-preview-tts",
    "gemini-2.0-flash",
  ];
  for (const m of models) {
    await testModel(m);
  }
}

run();
