import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({
  path: ".env.local",
});

const apiKey = process.env.GEMINI_DOCUMENT_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_DOCUMENT_API_KEY topilmadi.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function main() {
  console.log("========================================");
  console.log("      GEMINI GENERATECONTENT AUDIT");
  console.log("========================================\n");

  const pager = await ai.models.list();

  let total = 0;
  let passed = 0;
  let failed = 0;

  for await (const model of pager) {
    const methods = model.supportedActions ?? [];

    if (!methods.includes("generateContent")) {
      continue;
    }

    total++;

    const modelName = model.name ?? "UNKNOWN";

    process.stdout.write(`${modelName.padEnd(50)} `);

    try {
      const result = await ai.models.generateContent({
        model: modelName,
        contents: "Reply only: OK",
      });

      const text = (result.text ?? "").trim();

      if (text.toUpperCase() === "OK") {
        passed++;
        console.log("✅ PASS");
      } else {
        passed++;
        console.log(`✅ PASS (Response: ${text})`);
      }
    } catch (err: any) {
      failed++;

      const status =
        err?.status ??
        err?.code ??
        err?.error?.code ??
        "UNKNOWN";

      const message =
        err?.message ??
        err?.error?.message ??
        "No error message";

      console.log(`❌ ${status} - ${message}`);
    }
  }

  console.log("\n========================================");
  console.log("              SUMMARY");
  console.log("========================================");
  console.log(`Total Models Tested : ${total}`);
  console.log(`Passed             : ${passed}`);
  console.log(`Failed             : ${failed}`);
  console.log("========================================");
  console.log("✅ Audit completed.");
}

main().catch((err) => {
  console.error("\n❌ Fatal Error:");
  console.error(err);
});