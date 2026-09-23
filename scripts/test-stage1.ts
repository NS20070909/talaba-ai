import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.gemini_ai_chat || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ gemini_ai_chat or GEMINI_API_KEY not found.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";

async function testAll() {
  console.log("=== Testing AI Chat Study Mentor (Stage 1) ===");

  // 1. Test Socratic mode
  console.log("\n1. Testing Socratic Prompt Generation...");
  const socraticRes = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: "Nyutonning birinchi qonunini tushuntirib ber." }] }],
    config: {
      systemInstruction: `Siz Sokratik O'qituvchisiz. Darhol javob bermang, yo'naltiruvchi savol bering.`,
      temperature: 0.7,
      maxOutputTokens: 200,
    },
  });
  console.log("✅ Socratic response received:\n", socraticRes.text?.slice(0, 150) + "...");

  // 2. Test Meni Tekshir (AI Generate Questions)
  console.log("\n2. Testing Meni Tekshir (generate_questions)...");
  const questionsRes = await ai.models.generateContent({
    model,
    contents: [{
      role: "user",
      parts: [{
        text: `Fan: "Matematika", Mavzu: "Kvadrat tenglamalar", Soni: 2 ta savol. JSON formatida bering: {"questions":[{"id":1,"question":"...","options":["A) ...","B) ...","C) ...","D) ..."],"correctAnswer":"A","explanation":"..."}]}`
      }]
    }],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  console.log("✅ Question generation response received:\n", questionsRes.text);

  // 3. Test Meni Tekshir (evaluate_answers)
  console.log("\n3. Testing Meni Tekshir (evaluate_answers)...");
  const evalRes = await ai.models.generateContent({
    model,
    contents: [{
      role: "user",
      parts: [{
        text: `Savol: x^2 - 4 = 0 ning ildizlari qaysilar? Variantlar: A) 2, -2; B) 4, -4; C) 0; D) 1. To'g'ri javob: A. Talaba javobi: B. Tahlil qilib foiz, xato va tavsiya bering JSON: {"scorePercent":0,"mistakes":[{"question":"...","userAnswer":"B","correctAnswer":"A","explanation":"..."}],"weakTopics":["..."],"recommendation":"..."}`
      }]
    }],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  console.log("✅ Evaluation response received:\n", evalRes.text);

  console.log("\n🎉 All Stage 1 Gemini API integration tests passed successfully!");
}

testAll().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
