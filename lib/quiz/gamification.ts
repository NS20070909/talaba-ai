import { getSupabase } from "../supabase";
import { QuizQuestion } from "./types";

export interface QuizUserGamificationStats {
  userId: number;
  userName: string;
  totalQuizzes: number;
  totalQuestions: number;
  correctAnswers: number;
  accuracyRate: number;
  streakCount: number;
  xp: number;
  rank?: number;
  achievements: AchievementBadge[];
  wrongAnswersCount: number;
}

export interface AchievementBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface WrongAnswerItem {
  id: string;
  quizId?: string;
  questionText: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  correctOptionId: string;
  explanation?: string;
  resolved: boolean;
  createdAt: string;
}

export const ALL_ACHIEVEMENTS: Omit<AchievementBadge, "unlocked" | "unlockedAt">[] = [
  { id: "quiz_first", title: "Birinchi Qadam", description: "Birinchi quizni muvaffaqiyatli yakunladingiz", icon: "🌱" },
  { id: "quiz_5", title: "Bilim Ishtiyoqi", description: "5 ta quizni yakunladingiz", icon: "🚀" },
  { id: "quiz_10", title: "Quiz Ustasi", description: "10 ta quizni yakunladingiz", icon: "🧠" },
  { id: "quiz_perfect", title: "Mukammal Natija", description: "Quizdagi barcha savollarga 100% to'g'ri javob berdingiz", icon: "🎯" },
  { id: "quiz_streak_3", title: "3 Kunlik Olov", description: "Ketma-ket 3 kun quiz ishladik", icon: "🔥" },
  { id: "quiz_streak_7", title: "Haftalik Chempion", description: "Ketma-ket 7 kun davomida quiz ishladik", icon: "👑" },
  { id: "quiz_wrong_master", title: "Xatolarni Tuzatuvchi", description: "5 ta noto'g'ri javobni retry rejimida qayta ishladingiz", icon: "🛠" },
];

export async function getUserGamificationStats(userId: number, userName?: string): Promise<QuizUserGamificationStats> {
  const supabase = getSupabase();

  let stats = {
    userId,
    userName: userName || `Foydalanuvchi #${userId}`,
    totalQuizzes: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    accuracyRate: 0,
    streakCount: 0,
    xp: 0,
  };

  try {
    const { data: dbStats } = await supabase
      .from("quiz_user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (dbStats) {
      stats.userName = dbStats.user_name || stats.userName;
      stats.totalQuizzes = dbStats.total_quizzes || 0;
      stats.totalQuestions = dbStats.total_questions || 0;
      stats.correctAnswers = dbStats.correct_answers || 0;
      stats.streakCount = dbStats.streak_count || 0;
      stats.xp = dbStats.xp || 0;
      stats.accuracyRate = stats.totalQuestions > 0 ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100) : 0;
    }
  } catch (err) {
    console.error("getUserGamificationStats db error:", err);
  }

  // Get User Rank
  let rank: number | undefined = undefined;
  try {
    const { count } = await supabase
      .from("quiz_user_stats")
      .select("*", { count: "exact", head: true })
      .gt("xp", stats.xp);

    rank = (count || 0) + 1;
  } catch {}

  // Get Unlocked Achievements
  const unlockedBadgesMap = new Map<string, string>();
  try {
    const { data: achievementsData } = await supabase
      .from("quiz_achievements")
      .select("badge_id, unlocked_at")
      .eq("user_id", userId);

    if (achievementsData) {
      achievementsData.forEach((a) => unlockedBadgesMap.set(a.badge_id, a.unlocked_at));
    }
  } catch {}

  const achievements: AchievementBadge[] = ALL_ACHIEVEMENTS.map((b) => ({
    ...b,
    unlocked: unlockedBadgesMap.has(b.id),
    unlockedAt: unlockedBadgesMap.get(b.id),
  }));

  // Get Wrong Answers Count
  let wrongAnswersCount = 0;
  try {
    const { count } = await supabase
      .from("quiz_wrong_answers")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("resolved", false);

    wrongAnswersCount = count || 0;
  } catch {}

  return {
    ...stats,
    rank,
    achievements,
    wrongAnswersCount,
  };
}

export async function recordQuizResult(
  userId: number,
  userName: string,
  totalQuestions: number,
  correctAnswers: number,
  wrongQuestions: Array<{ questionText: string; options: any[]; correctOptionId: string; explanation?: string }>
): Promise<{ xpGained: number; newAchievements: string[] }> {
  const supabase = getSupabase();
  const todayStr = new Date().toISOString().split("T")[0];

  let streak = 1;
  let prevXp = 0;
  let prevTotalQuizzes = 0;
  let prevTotalQuestions = 0;
  let prevCorrect = 0;

  try {
    const { data: existing } = await supabase
      .from("quiz_user_stats")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (existing) {
      prevXp = existing.xp || 0;
      prevTotalQuizzes = existing.total_quizzes || 0;
      prevTotalQuestions = existing.total_questions || 0;
      prevCorrect = existing.correct_answers || 0;

      const lastDate = existing.last_quiz_date ? new Date(existing.last_quiz_date) : null;
      if (lastDate) {
        const today = new Date(todayStr);
        const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

        if (diffDays === 1) {
          streak = (existing.streak_count || 0) + 1;
        } else if (diffDays === 0) {
          streak = existing.streak_count || 1;
        } else {
          streak = 1; // Streak reset
        }
      }
    }
  } catch (err) {}

  const xpGained = correctAnswers * 10 + streak * 5;
  const newXp = prevXp + xpGained;
  const newTotalQuizzes = prevTotalQuizzes + 1;
  const newTotalQuestions = prevTotalQuestions + totalQuestions;
  const newCorrect = prevCorrect + correctAnswers;

  // Upsert user stats
  try {
    await supabase.from("quiz_user_stats").upsert({
      user_id: userId,
      user_name: userName || `User #${userId}`,
      total_quizzes: newTotalQuizzes,
      total_questions: newTotalQuestions,
      correct_answers: newCorrect,
      streak_count: streak,
      last_quiz_date: todayStr,
      xp: newXp,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("recordQuizResult upsert error:", err);
  }

  // Insert wrong answers for retry mode
  if (wrongQuestions && wrongQuestions.length > 0) {
    try {
      const records = wrongQuestions.map((q) => ({
        user_id: userId,
        question_text: q.questionText,
        options: q.options,
        correct_option_id: q.correctOptionId,
        explanation: q.explanation || null,
        resolved: false,
      }));

      await supabase.from("quiz_wrong_answers").insert(records);
    } catch (err) {
      console.error("recordQuizResult wrong answers insert error:", err);
    }
  }

  // Check & Unlock Achievements
  const newAchievements: string[] = [];
  const checkUnlock = async (badgeId: string) => {
    try {
      const { error } = await supabase.from("quiz_achievements").insert({
        user_id: userId,
        badge_id: badgeId,
      });
      if (!error) {
        newAchievements.push(badgeId);
      }
    } catch {}
  };

  if (newTotalQuizzes >= 1) await checkUnlock("quiz_first");
  if (newTotalQuizzes >= 5) await checkUnlock("quiz_5");
  if (newTotalQuizzes >= 10) await checkUnlock("quiz_10");
  if (totalQuestions > 0 && correctAnswers === totalQuestions) await checkUnlock("quiz_perfect");
  if (streak >= 3) await checkUnlock("quiz_streak_3");
  if (streak >= 7) await checkUnlock("quiz_streak_7");

  return { xpGained, newAchievements };
}

export async function getQuizLeaderboard(limit = 20): Promise<Array<{ rank: number; userId: number; userName: string; xp: number; totalQuizzes: number; streakCount: number }>> {
  const supabase = getSupabase();
  try {
    const { data } = await supabase
      .from("quiz_user_stats")
      .select("user_id, user_name, xp, total_quizzes, streak_count")
      .order("xp", { ascending: false })
      .limit(limit);

    if (data) {
      return data.map((item, idx) => ({
        rank: idx + 1,
        userId: Number(item.user_id),
        userName: item.user_name || `Foydalanuvchi #${item.user_id}`,
        xp: item.xp || 0,
        totalQuizzes: item.total_quizzes || 0,
        streakCount: item.streak_count || 0,
      }));
    }
  } catch (err) {
    console.error("getQuizLeaderboard error:", err);
  }
  return [];
}

export async function getWrongAnswersForRetry(userId: number, limit = 20): Promise<WrongAnswerItem[]> {
  const supabase = getSupabase();
  try {
    const { data } = await supabase
      .from("quiz_wrong_answers")
      .select("*")
      .eq("user_id", userId)
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (data) {
      return data.map((d) => ({
        id: d.id,
        quizId: d.quiz_id,
        questionText: d.question_text,
        options: d.options,
        correctOptionId: d.correct_option_id,
        explanation: d.explanation,
        resolved: d.resolved,
        createdAt: d.created_at,
      }));
    }
  } catch (err) {
    console.error("getWrongAnswersForRetry error:", err);
  }
  return [];
}

export async function markWrongAnswerResolved(id: string, userId: number): Promise<boolean> {
  const supabase = getSupabase();
  try {
    const { error } = await supabase
      .from("quiz_wrong_answers")
      .update({ resolved: true })
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) {
      // Check if unlocked wrong_master achievement
      const { count } = await supabase
        .from("quiz_wrong_answers")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("resolved", true);

      if ((count || 0) >= 5) {
        try {
          await supabase.from("quiz_achievements").insert({
            user_id: userId,
            badge_id: "quiz_wrong_master",
          });
        } catch {}
      }

      return true;
    }
  } catch (err) {
    console.error("markWrongAnswerResolved error:", err);
  }
  return false;
}
