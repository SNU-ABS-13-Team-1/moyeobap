-- ========================================================
-- 미니게임 점수 기록 (게임별 재사용 가능한 공용 테이블)
-- ========================================================

CREATE TABLE IF NOT EXISTS public.game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON public.game_scores(game, score DESC);

ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- pots/restaurants와 동일하게, anon/authenticated 직접 접근은 막고
-- 서버(API 라우트)에서 service_role로만 읽고 씁니다.
REVOKE ALL ON public.game_scores FROM anon, authenticated;
