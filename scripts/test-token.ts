import { GoogleGenAI, Modality } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;
console.log("Testing authTokens.create...");
const ai = new GoogleGenAI({ apiKey: apiKey!, apiVersion: "v1alpha" });

async function testToken() {
  try {
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
        expireTime: new Date(Date.now() + 10 * 60_000).toISOString(),
        liveConnectConstraints: {
          model: "gemini-2.5-flash-native-audio-latest",
          config: {
            responseModalities: [Modality.AUDIO],
          },
        },
      },
    });
    console.log("Token success:", token.name);
  } catch (e: any) {
    console.error("Token error:", e?.message || e);
  }
}

testToken();

