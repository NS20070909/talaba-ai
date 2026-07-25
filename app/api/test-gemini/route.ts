import { runGeminiWithFallback } from "@/lib/ai-fallback-runner";
import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET() {
  try {
    const apiKey = process.env.REFERAT_GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing REFERAT_GEMINI_API_KEY in environment variables",
        },
        { status: 500 }
      );
    }

    const prompt = "Reply with: Gemini connection successful";
    const { text, model } = await runGeminiWithFallback({
      apiKey,
    modelChain: [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash",
],
      prompt,
    });

    return NextResponse.json({
      success: true,
      model,
      message: text.trim(), // Should be "Gemini connection successful"
    });
  } catch (error: any) {
    console.error("Gemini connection error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to connect to Gemini",
      },
      { status: 500 }
    );
  }
}
