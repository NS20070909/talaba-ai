-- Migration for Quiz Engine Gamification (Leaderboard, Stats, Wrong Answers Retry, Achievements, Daily Streak)

-- 1. User Gamification Stats
CREATE TABLE IF NOT EXISTS quiz_user_stats (
  user_id BIGINT PRIMARY KEY,
  user_name TEXT,
  total_quizzes INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  correct_answers INTEGER DEFAULT 0,
  streak_count INTEGER DEFAULT 0,
  last_quiz_date DATE,
  xp INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Wrong Answers Storage for Retry Mode
CREATE TABLE IF NOT EXISTS quiz_wrong_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  quiz_id TEXT,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_option_id TEXT NOT NULL,
  explanation TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Achievements Unlocked by User
CREATE TABLE IF NOT EXISTS quiz_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL,
  badge_id VARCHAR(50) NOT NULL,
  unlocked_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_quiz_user_badge UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_stats_xp ON quiz_user_stats(xp DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_wrong_user ON quiz_wrong_answers(user_id, resolved);
CREATE INDEX IF NOT EXISTS idx_quiz_achieve_user ON quiz_achievements(user_id);
