-- ========================================================
-- 실시간 Pong 대전: 방, 방 채팅, 전적, ELO 랭킹
--
-- 공/패들의 프레임 단위 좌표는 저장하지 않습니다(항상 ephemeral, Supabase
-- Realtime Broadcast로만 오갑니다). DB에는 방 메타데이터와 점수/승패만
-- 저장해서 서버가 "진짜로 신뢰해야 하는" 부분만 관리합니다.
-- ========================================================

-- 1. Pong 방 ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pong_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT 'Pong 방',
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
    player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player1_name TEXT NOT NULL,
    player2_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    player2_name TEXT,
    score1 INTEGER NOT NULL DEFAULT 0,
    score2 INTEGER NOT NULL DEFAULT 0,
    winner TEXT CHECK (winner IN ('player1', 'player2')),
    started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pong_rooms_status ON public.pong_rooms(status);

ALTER TABLE public.pong_rooms ENABLE ROW LEVEL SECURITY;

-- 방 생성/참여/점수 반영은 서버(API)에서 service_role로만 처리합니다.
REVOKE ALL ON public.pong_rooms FROM anon, authenticated;

-- Realtime 구독(점수 변경, 게임 종료)은 참여자 본인에게만 즉시 반영됩니다.
-- 관전자는 폴링으로 따라잡습니다.
GRANT SELECT ON public.pong_rooms TO authenticated;

CREATE POLICY "pong_rooms_select_participants" ON public.pong_rooms FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = player1_id OR (SELECT auth.uid()) = player2_id);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pong_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 방 채팅 -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pong_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.pong_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pong_chat_room_created_at
    ON public.pong_chat_messages(room_id, created_at);

ALTER TABLE public.pong_chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pong_chat_messages FROM anon, authenticated;

GRANT SELECT ON public.pong_chat_messages TO authenticated;

CREATE POLICY "pong_chat_select_participants" ON public.pong_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.pong_rooms r
        WHERE r.id = room_id
          AND ((SELECT auth.uid()) = r.player1_id OR (SELECT auth.uid()) = r.player2_id)
    )
);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pong_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. 대전 전적 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pong_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.pong_rooms(id) ON DELETE CASCADE,
    player1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player1_name TEXT NOT NULL,
    player2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player2_name TEXT NOT NULL,
    winner TEXT NOT NULL CHECK (winner IN ('player1', 'player2')),
    score1 INTEGER NOT NULL,
    score2 INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pong_matches_player1 ON public.pong_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_pong_matches_player2 ON public.pong_matches(player2_id);

ALTER TABLE public.pong_matches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pong_matches FROM anon, authenticated;

-- 4. ELO 랭킹 -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pong_ratings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1000,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pong_ratings_rating ON public.pong_ratings(rating DESC);

ALTER TABLE public.pong_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pong_ratings FROM anon, authenticated;
