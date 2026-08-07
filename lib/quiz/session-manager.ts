import { getSupabase } from "../supabase";
import { QuizQuestion, QuizConfig } from "./types";

export interface QuizUserSession {
  id?: string;
  userId: number;
  fileHash?: string;
  fileName?: string;
  step: "INPUT" | "EDIT" | "CONFIG" | "PREVIEW" | "COMPLETED";
  rawText?: string;
  questions?: QuizQuestion[];
  settings?: QuizConfig;
  updatedAt?: string;
}

export async function getActiveUserSession(userId: number): Promise<QuizUserSession | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select("*")
      .eq("user_id", userId)
      .neq("step", "COMPLETED")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: Number(data.user_id),
      fileHash: data.file_hash,
      fileName: data.file_name,
      step: data.step,
      rawText: data.raw_text,
      questions: data.questions || [],
      settings: data.settings || {},
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error("getActiveUserSession exception:", err);
    return null;
  }
}

export async function getLatestUserSession(userId: number): Promise<QuizUserSession | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("quiz_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: Number(data.user_id),
      fileHash: data.file_hash,
      fileName: data.file_name,
      step: data.step,
      rawText: data.raw_text,
      questions: data.questions || [],
      settings: data.settings || {},
      updatedAt: data.updated_at,
    };
  } catch (err) {
    return null;
  }
}

export async function saveUserSession(session: QuizUserSession): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from("quiz_sessions").upsert(
      {
        user_id: session.userId,
        file_hash: session.fileHash || null,
        file_name: session.fileName || null,
        step: session.step,
        raw_text: session.rawText || "",
        questions: session.questions || [],
        settings: session.settings || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) {
      return false;
    }
    return true;
  } catch (err: any) {
    return false;
  }
}

export async function clearUserSession(userId: number): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("quiz_sessions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("clearUserSession error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("clearUserSession exception:", err);
    return false;
  }
}

export async function completeUserSession(userId: number): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("quiz_sessions")
      .update({ step: "COMPLETED" })
      .eq("user_id", userId);
    return !error;
  } catch {
    return false;
  }
}
