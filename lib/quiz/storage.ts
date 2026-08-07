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
    
    // As per V4 spec: telegram_id, title, question_count, created_at, mode, timer, target, status
    const insertPayload: any = {
      telegram_id: userId,
      title: title || "Yangi Test",
      question_count: questions.length,
      mode: settings.builderMode || "SINGLE",
      timer: settings.timerSeconds || 0,
      target: "telegram",
      status: "COMPLETED",
      created_at: new Date().toISOString()
    };

    let { data, error } = await supabase
      .from("quiz_history")
      .insert(insertPayload)
      .select("*")
      .single();

    if (error) {
      // Automatically adapt: If the new schema isn't fully migrated, fallback silently
      const fallbackPayload = {
        user_id: userId,
        title: title || "Yangi Test",
        question_count: questions.length,
        settings: settings || {},
        questions: questions || [],
        created_at: new Date().toISOString(),
      };
      const retry = await supabase.from("quiz_history").insert(fallbackPayload).select("*").single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: Number(data.user_id || data.telegram_id),
      title: data.title,
      sourceFileName: data.source_file_name || "",
      questionCount: data.question_count,
      settings: data.settings || {},
      questions: data.questions || [],
      telegramMessageIds: data.telegram_message_ids || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at || data.created_at,
    };
  } catch (err: any) {
    return null;
  }
}

export async function getUserQuizHistory(userId: number): Promise<QuizHistoryRecord[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("quiz_history")
      .select("*")
      // Try filtering by telegram_id, fallback to user_id dynamically if one is missing?
      // Supabase REST requires knowing the column. We will use `or(telegram_id.eq.X,user_id.eq.X)`
      .or(`telegram_id.eq.${userId},user_id.eq.${userId}`)
      .order("created_at", { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      userId: Number(row.user_id || row.telegram_id),
      title: row.title,
      sourceFileName: row.source_file_name || "",
      questionCount: row.question_count,
      settings: row.settings || {},
      questions: row.questions || [],
      telegramMessageIds: row.telegram_message_ids || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    }));
  } catch (err) {
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
      .or(`telegram_id.eq.${userId},user_id.eq.${userId}`)
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
      updatedAt: data.updated_at || data.created_at,
    };
  } catch (err) {
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
      .or(`telegram_id.eq.${userId},user_id.eq.${userId}`);

    if (error) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}
