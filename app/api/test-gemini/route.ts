import { GoogleGenerativeAI } from "@google/generative-ai";
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = "Reply with: Gemini connection successful";
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({
      success: true,
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
