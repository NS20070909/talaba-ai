import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey! });

async function test() {
  console.log('Testing models for Google Search grounding...');
  const models = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-2.5-pro'];
  for (const model of models) {
    try {
      console.log(`Trying ${model}...`);
      const res = await ai.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: "O'zbekistonda 2026-yilgi eng so'nggi yangiliklar qisqa konspekt" }] }
        ],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      console.log(`[${model}] Success! Text length: ${res.text?.length}`);
      const candidate = res.candidates?.[0];
      const chunks = (candidate as any)?.groundingMetadata?.groundingChunks;
      console.log(`[${model}] Grounding chunks count: ${chunks?.length || 0}`);
      if (chunks && chunks.length > 0) {
        console.log(`[${model}] Sample source:`, chunks[0]?.web?.title, chunks[0]?.web?.uri);
      }
      break;
    } catch (e: any) {
      console.error(`[${model}] Error:`, e?.message || e);
    }
  }
}

test();
