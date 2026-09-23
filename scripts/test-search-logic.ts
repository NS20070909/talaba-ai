import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Exact function from app/ai-chat/page.tsx
function isInternetSearchIntent(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(internetdan|internetan|internetda|interneta|webdan|vebdan|googledan|googleda|saytlardan)\b/i.test(t)) {
    return true;
  }
  const hasPlatform = /(internet|internetan|web|veb|google|sayt|onlayn)/i.test(t);
  const hasAction = /(izla|qidir|tekshir|top|topib|topish|ko'r|kor|qara|ma'lumot|malumot|yangilik|fakt|ssilka|manba|sayt)/i.test(t);
  if (hasPlatform && hasAction) {
    return true;
  }
  if (/(internet|web|google)\s*(orqali|yordamida|bilan)/i.test(t)) {
    return true;
  }
  return false;
}

// Test cases
const testPrompts = [
  { text: "internetan menga sex haqida malumot topib ber rasmlari bilan", expected: true },
  { text: "internetdan izla", expected: true },
  { text: "internetdan top", expected: true },
  { text: "webdan tekshir", expected: true },
  { text: "googledan top", expected: true },
  { text: "internetdan ma'lumot top", expected: true },
  { text: "yangiliklarni internetdan top", expected: true },
  { text: "Menga kvadrat tenglama yechimini tushuntir", expected: false },
  { text: "Python dasturlash tilida sikllar", expected: false }
];

console.log("=== 1. INTENT DETECTION TESTS ===");
let allPassed = true;
for (const tc of testPrompts) {
  const result = isInternetSearchIntent(tc.text);
  const ok = result === tc.expected;
  if (!ok) allPassed = false;
  console.log(`${ok ? "✓" : "✗"} "${tc.text}" -> detected: ${result} (expected: ${tc.expected})`);
}

console.log("\n=== 2. TOGGLE & TOAST STATE SIMULATION ===");
function simulateSend(trimmed: string, webSearchEnabled: boolean) {
  let toast = "";
  let nextToggle = webSearchEnabled;
  let useSearch = webSearchEnabled;

  const isExplicitSearch = isInternetSearchIntent(trimmed);
  if (isExplicitSearch) {
    if (webSearchEnabled) {
      toast = "🌐 Internetga kirish ochiq";
      useSearch = true;
    } else {
      nextToggle = true;
      useSearch = true;
      toast = "🌐 Internetdan qidirish yoqildi";
    }
  }
  return { toast, nextToggle, useSearch };
}

// Case A: Toggle ON + "internetan menga ... malumot topib ber"
const simA = simulateSend("internetan menga sex haqida malumot topib ber rasmlari bilan", true);
console.log("Case A (Toggle ON + internetan):", simA);
console.log("-> Toast is '🌐 Internetga kirish ochiq'?", simA.toast === "🌐 Internetga kirish ochiq");
console.log("-> useSearch is true?", simA.useSearch === true);

// Case B: Toggle OFF + "internetan menga ... malumot topib ber"
const simB = simulateSend("internetan menga sex haqida malumot topib ber rasmlari bilan", false);
console.log("Case B (Toggle OFF + internetan):", simB);
console.log("-> Toast is '🌐 Internetdan qidirish yoqildi'?", simB.toast === "🌐 Internetdan qidirish yoqildi");
console.log("-> Toggle switched to ON?", simB.nextToggle === true);
console.log("-> useSearch is true?", simB.useSearch === true);

console.log("\n=== 3. REAL GOOGLE SEARCH GROUNDING API CALL ===");
const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey! });

async function runRealGrounding() {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: "O'zbekistonda 2026-yilgi eng so'nggi yangiliklar qisqa konspekt" }] }],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const candidate = res.candidates?.[0];
    const groundingChunks = (candidate as any)?.groundingMetadata?.groundingChunks;
    console.log("Response text len:", res.text?.length);
    console.log("Grounding chunks count:", groundingChunks?.length || 0);
    if (groundingChunks && groundingChunks.length > 0) {
      console.log("First chunk web title:", groundingChunks[0]?.web?.title);
      console.log("First chunk web URI:", groundingChunks[0]?.web?.uri);
    }
  } catch (e: any) {
    console.error("Grounding error:", e?.message || e);
  }
}

runRealGrounding();
