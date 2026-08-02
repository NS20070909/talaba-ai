import { getSupabase } from "../supabase";
import { QuizHistoryRecord, QuizQuestion, QuizConfig } from "./types";

export async function saveQuizHistory(
  userId: number,
  title: string,
  questions: QuizQuestion[],
  settings: QuizConfig,
  sourceFileName?: string,
  telegramMessageIds: number[] = []
): Promise<QuizHistoryRecord | null> {
  try {
    const supabase = getSupabase();
    const insertPayload: any = {
      user_id: userId,
      title: title || "Quiz",
      source_file_name: sourceFileName || null,
      question_count: questions.length,
      settings: settings || {},
      questions: questions || [],
      telegram_message_ids: telegramMessageIds,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from("quiz_history")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error && (error.code === "PGRST204" || String(error.message).includes("telegram_message_ids"))) {
      delete insertPayload.telegram_message_ids;
      delete insertPayload.source_file_name;
      const retry = await supabase.from("quiz_history").insert(insertPayload).select("*").single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      console.error("saveQuizHistory DB error:", error);
      return null;
    }

    return {
      id: data.id,
      userId: Number(data.user_id),
      title: data.title,
      sourceFileName: data.source_file_name,
      questionCount: data.question_count,
      settings: data.settings,
      questions: data.questions,
      telegramMessageIds: data.telegram_message_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error("saveQuizHistory exception:", err);
    return null;
  }
}

export async function getUserQuizHistory(userId: number): Promise<QuizHistoryRecord[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("quiz_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("getUserQuizHistory error:", error);
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      userId: Number(row.user_id),
      title: row.title,
      sourceFileName: row.source_file_name,
      questionCount: row.question_count,
      settings: row.settings,
      questions: row.questions,
      telegramMessageIds: row.telegram_message_ids || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (err) {
    console.error("getUserQuizHistory exception:", err);
    return [];
  }
}

export async function getQuizHistoryById(id: string, userId: number): Promise<QuizHistoryRecord | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("quiz_history")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    return {
      id: data.id,
      userId: Number(data.user_id),
      title: data.title,
      sourceFileName: data.source_file_name,
      questionCount: data.question_count,
      settings: data.settings,
      questions: data.questions,
      telegramMessageIds: data.telegram_message_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (err) {
    console.error("getQuizHistoryById exception:", err);
    return null;
  }
}

export async function deleteQuizHistoryRecord(id: string, userId: number): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("quiz_history")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      console.error("deleteQuizHistoryRecord error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("deleteQuizHistoryRecord exception:", err);
    return false;
  }
}
