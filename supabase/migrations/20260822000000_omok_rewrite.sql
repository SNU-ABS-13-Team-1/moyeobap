-- ========================================================
-- 오목 재구현: 방 이름, 동시성 방지, 마지막 착수 강조, 방 채팅,
-- 전적 기록, ELO 랭킹
-- ========================================================

-- 1. omok_rooms 확장 -------------------------------------------------
ALTER TABLE public.omok_rooms
    ADD COLUMN IF NOT EXISTS room_name TEXT NOT NULL DEFAULT '오목 방',
    ADD COLUMN IF NOT EXISTS move_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_row INTEGER,
    ADD COLUMN IF NOT EXISTS last_col INTEGER,
    -- 이번 대국 라운드가 실제로 시작된 시각. updated_at은 착수마다 바뀌므로
    -- 전적(omok_matches)의 started_at은 이 값을 기준으로 기록합니다.
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- 2. 방 채팅 -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omok_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.omok_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omok_chat_room_created_at
    ON public.omok_chat_messages(room_id, created_at);

ALTER TABLE public.omok_chat_messages ENABLE ROW LEVEL SECURITY;

-- 채팅 작성은 서버(API)에서 service_role로만 처리합니다.
REVOKE ALL ON public.omok_chat_messages FROM anon, authenticated;

-- Realtime 구독은 대국 참여자(흑/백) 본인에게만 즉시 반영됩니다. 관전자는
-- 서버가 내려주는 polling(GET) 결과로 몇 초 뒤 자연스럽게 따라잡습니다.
GRANT SELECT ON public.omok_chat_messages TO authenticated;

CREATE POLICY "omok_chat_select_participants" ON public.omok_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.omok_rooms r
        WHERE r.id = room_id
          AND ((SELECT auth.uid()) = r.black_id OR (SELECT auth.uid()) = r.white_id)
    )
);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.omok_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. 대국 전적 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omok_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.omok_rooms(id) ON DELETE CASCADE,
    black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT NOT NULL,
    white_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT NOT NULL,
    winner TEXT NOT NULL CHECK (winner IN ('black', 'white', 'draw')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omok_matches_black ON public.omok_matches(black_id);
CREATE INDEX IF NOT EXISTS idx_omok_matches_white ON public.omok_matches(white_id);

ALTER TABLE public.omok_matches ENABLE ROW LEVEL SECURITY;

-- game_scores와 동일하게 서버(API)에서 service_role로만 읽고 씁니다.
REVOKE ALL ON public.omok_matches FROM anon, authenticated;

-- 4. ELO 랭킹 -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.omok_ratings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1200,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omok_ratings_rating ON public.omok_ratings(rating DESC);

ALTER TABLE public.omok_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.omok_ratings FROM anon, authenticated;
