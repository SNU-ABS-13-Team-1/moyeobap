-- ========================================================
-- 주간 랭킹: 매주 월요일 0시(KST)에 모든 미니게임 랭킹이 새로 시작하고,
-- 지난주 상위 3명은 명예의 전당(game_week_hall)에 남습니다.
--
-- - game_scores(스네이크·플래피·컴퓨터 체스/루미)는 기록이 시각과 함께 쌓이므로
--   스키마 변경 없이 "이번 주 기록만" 집계합니다.
-- - 레이팅 표 4개(오목·체스·퐁·루미 온라인)는 사용자당 1행 누적이라, 주 키(week_key =
--   그 주 월요일의 KST 날짜 "YYYY-MM-DD")를 붙여 (user_id, week_key)당 1행으로 바꿉니다.
--   → 새 주가 시작되면 레이팅 1200(루미는 0점)에서 다시 시작합니다. 지난 주 행은 그대로 남습니다.
-- - 전적(matches) 표들은 그대로 둡니다(기록 보존).
-- ========================================================

-- 1. 레이팅 표에 주 키 추가 ------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['omok_ratings', 'chess_ratings', 'pong_ratings', 'rummy_ratings'] LOOP
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS week_key TEXT NOT NULL DEFAULT ''''', t);
        -- 기존 행은 마지막 갱신 시각이 속한 주로 분류합니다(date_trunc(week)는 ISO 월요일 시작).
        EXECUTE format(
            'UPDATE public.%I SET week_key = to_char(date_trunc(''week'', (updated_at AT TIME ZONE ''Asia/Seoul''))::date, ''YYYY-MM-DD'') WHERE week_key = ''''',
            t
        );
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_pkey');
        EXECUTE format('ALTER TABLE public.%I ADD PRIMARY KEY (user_id, week_key)', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (week_key)', 'idx_' || t || '_week', t);
    END LOOP;
END $$;

-- 2. 명예의 전당 -----------------------------------------------------------
-- 한 게임의 한 주가 끝나면 상위 3명을 스냅샷으로 남깁니다. 새 주에 누군가 랭킹을
-- 열람할 때 서버가 지난주 스냅샷이 없으면 만들어 넣습니다(별도 스케줄러 불필요).
CREATE TABLE IF NOT EXISTS public.game_week_hall (
    game TEXT NOT NULL,
    week_key TEXT NOT NULL,
    -- [{ userId, userName, value }] 1~3위 순. value는 게임에 따라 점수·레이팅.
    entries JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (game, week_key)
);
ALTER TABLE public.game_week_hall ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_week_hall FROM anon, authenticated;
