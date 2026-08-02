import crypto from "crypto";
import { getSupabase } from "../supabase";
import { QuizQuestion } from "./types";

export interface CachedQuizData {
  hash: string;
  fileName: string;
  fileType: string;
  rawText: string;
  questions: QuizQuestion[];
  createdAt: string;
}

export function calculateFileHash(fileBuffer: Buffer): string {
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

export async function getCachedQuizByHash(hash: string): Promise<CachedQuizData | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("quiz_cache")
      .select("*")
      .eq("hash", hash)
      .single();

    if (error || !data) return null;

    return {
      hash: data.hash,
      fileName: data.file_name,
      fileType: data.file_type,
      rawText: data.raw_text,
      questions: data.questions,
      createdAt: data.created_at,
    };
  } catch (err) {
    console.error("getCachedQuizByHash exception:", err);
    return null;
  }
}

export async function saveQuizToCache(
  hash: string,
  fileName: string,
  fileType: string,
  rawText: string,
  questions: QuizQuestion[]
): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("quiz_cache").upsert(
      {
        hash,
        file_name: fileName,
        file_type: fileType,
        raw_text: rawText,
        questions,
        created_at: new Date().toISOString(),
      },
      { onConflict: "hash" }
    );

    if (error) {
      console.error("saveQuizToCache error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("saveQuizToCache exception:", err);
    return false;
  }
}
