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

    if (error || !data) {
      if (error && error.code !== "PGRST116") {
        console.warn(`[Cache] Lookup bypass (${error.message || error.code})`);
      }
      return null;
    }

    console.log(`[Cache] SHA-256 Hit for file hash ${hash.substring(0, 8)}...`);

    return {
      hash: data.hash,
      fileName: data.file_name,
      fileType: data.file_type,
      rawText: data.raw_text,
      questions: data.questions,
      createdAt: data.created_at,
    };
  } catch (err: any) {
    console.warn(`[Cache] Non-blocking lookup exception (${err?.message || "connection error"}). Proceeding with fresh parse.`);
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
      console.warn(`[Cache] Non-blocking save error (${error.message || error.code}). Quiz generated successfully.`);
      return false;
    }

    console.log(`[Cache] Successfully cached quiz for file hash ${hash.substring(0, 8)}...`);
    return true;
  } catch (err: any) {
    console.warn(`[Cache] Non-blocking save exception (${err?.message || "connection reset"}). Quiz generated successfully.`);
    return false;
  }
}
