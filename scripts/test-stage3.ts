import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ gemini_ai_chat or GEMINI_API_KEY not found.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey, apiVersion: "v1alpha" });

async function testStage3() {
  console.log("=== Testing Gemini Live Voice Architecture (Stage 3) ===");

  // 1. Test Ephemeral Token Generation for Olim (voice: Puck)
  console.log("\n1. Testing Ephemeral Live Token for Persona: Olim (Puck)...");
  const now = Date.now();
  const olimToken = await ai.authTokens.create({
    config: {
      uses: 1,
      newSessionExpireTime: new Date(now + 60000).toISOString(),
      expireTime: new Date(now + 30 * 60000).toISOString(),
      liveConnectConstraints: {
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Puck" },
            },
          },
        },
      },
    },
  });
  console.log("✅ Olim Live token created successfully:", olimToken.name);

  // 2. Test Ephemeral Live Token for Zilola (voice: Aoede)
  console.log("\n2. Testing Ephemeral Live Token for Persona: Zilola (Aoede)...");
  const zilolaToken = await ai.authTokens.create({
    config: {
      uses: 1,
      newSessionExpireTime: new Date(now + 60000).toISOString(),
      expireTime: new Date(now + 30 * 60000).toISOString(),
      liveConnectConstraints: {
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Aoede" },
            },
          },
        },
      },
    },
  });
  console.log("✅ Zilola Live token created successfully:", zilolaToken.name);

  // 3. Test Post-Session Structured Evaluation (IELTS simulation)
  console.log("\n3. Testing Post-Session IELTS Result Evaluation...");
  const textAi = new GoogleGenAI({ apiKey });
  const sampleTranscript = [
    { role: "assistant", text: "Good morning! Can you tell me about your hometown?" },
    { role: "user", text: "Good morning. I am living in Tashkent since 10 years, which is very beautiful and green city with lots of parks." },
    { role: "assistant", text: "What do you like most about living there?" },
    { role: "user", text: "I like the friendly people and public transportation is very convenient." },
  ];

  const transcriptText = sampleTranscript.map((t) => `${t.role}: ${t.text}`).join("\n");
  const evalPrompt = `Talaba bilan IELTS Speaking sinovi transkripti:
${transcriptText}
Sertifikatlangan IELTS Examiner sifatida baholang. JSON format: {"estimatedBand":"6.5","criteria":{"fluency":"6.5","grammar":"6.0","vocabulary":"6.5","pronunciation":"6.5"},"strengths":["..."],"grammarCorrections":[{"original":"...","corrected":"...","rule":"..."}],"nextStep":"..."}`;

  const evalRes = await textAi.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [{ role: "user", parts: [{ text: evalPrompt }] }],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  console.log("✅ IELTS evaluation JSON generated:\n", evalRes.text);

  console.log("\n🎉 All Stage 3 Gemini Live Voice tests completed successfully!");
}

testStage3().catch((err) => {
  console.error("❌ Stage 3 test failed:", err);
  process.exit(1);
});
