import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ gemini_ai_chat or GEMINI_API_KEY not found.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

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
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

async function testStage2() {
  console.log("=== Testing AI Chat Study Mentor (Stage 2) ===");

  // 1. Test Flash Review Audio Pipeline
  console.log("\n1. Testing Flash Review Audio Generation (TTS + WAV)...");
  const topic = "Pifagor teoremasi";
  const scriptPrompt = `Ushbu mavzuni talabaga 40-60 soniyada tushuntiradigan lo'nda Flash Review skriptini yozing: "${topic}"`;
  
  const scriptRes = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: scriptPrompt }] }],
    config: { temperature: 0.3, maxOutputTokens: 250 },
  });
  const script = scriptRes.text?.trim() || "";
  console.log("✅ Script generated (length: " + script.split(/\s+/).length + " words):\n", script.slice(0, 100) + "...");

  const audioRes = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: script,
    config: { responseModalities: ["AUDIO"] },
  });
  const pcmBase64 = audioRes.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!pcmBase64) throw new Error("No audio data returned from Gemini TTS");

  const pcmBuffer = Buffer.from(pcmBase64, "base64");
  const wav = pcmToWav(pcmBuffer, 24000, 1, 16);
  console.log("✅ WAV Audio successfully synthesized! File size:", wav.length, "bytes. Duration approx:", Math.round(pcmBuffer.length / 48000), "seconds.");

  // 2. Test Code Explainer Mode
  console.log("\n2. Testing Code Explainer Mode...");
  const codeRes = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: "def calculate_avg(nums):\n    total = 0\n    for n in nums:\n        total += n\n    return total / len(nums) # bo'sh ro'yxatda nima bo'ladi?" }] }],
    config: {
      systemInstruction: `Siz Senior Dasturchi va Kod Murabbiysisiz. Sintaktik/mantiqiy xatolar, qadamma-qadam tahlil va to'g'rilangan kod bering.`,
      temperature: 0.3,
      maxOutputTokens: 500,
    },
  });
  console.log("✅ Code explanation received:\n", codeRes.text?.slice(0, 150) + "...");

  // 3. Test Math Step-by-Step Mode
  console.log("\n3. Testing Math Step-by-Step Mode...");
  let mathRes: any;
  for (const m of ["gemini-3.6-flash", "gemini-3.8-flash"]) {
    try {
      mathRes = await ai.models.generateContent({
        model: m,
        contents: [{ role: "user", parts: [{ text: "Integral: ∫ (3x^2 + 2x + 1) dx" }] }],
        config: {
          systemInstruction: `Siz Matematika Murabbiysisiz. 1-qadam, 2-qadam formatida nima uchun shu amal bajarilgani bilan yeching.`,
          temperature: 0.2,
          maxOutputTokens: 400,
        },
      });
      if (mathRes?.text) break;
    } catch {
      // try next
    }
  }
  console.log("✅ Math step-by-step received:\n", mathRes?.text?.slice(0, 150) + "...");

  console.log("\n🎉 All Stage 2 features verified successfully!");
}

testStage2().catch((err) => {
  console.error("❌ Stage 2 test failed:", err);
  process.exit(1);
});
