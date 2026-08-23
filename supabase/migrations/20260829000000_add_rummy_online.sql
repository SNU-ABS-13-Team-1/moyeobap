-- ========================================================
-- 루미큐브 온라인 대전(2~4명): 방, 손패(비공개), 타일 더미(비공개), 채팅, 전적, 누적 점수 랭킹
--
-- 방(rummy_rooms)에는 모두가 봐도 되는 정보만 둡니다(테이블 위 세트, 각자 타일 장수, 차례).
-- 각자의 손패(rummy_hands)와 더미 순서(rummy_decks)는 서버(API)만 읽고 씁니다 —
-- Realtime 구독으로 행 전체가 내려가더라도 남의 패가 새지 않게 하기 위해서입니다.
-- ========================================================

-- 1. 방 ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rummy_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT '루미큐브 방',
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- [{ id, name, melded, tileCount, left, penalty?, score? }] 참여 순서대로(최대 4명)
    players JSONB NOT NULL DEFAULT '[]'::jsonb,
    turn_index INTEGER NOT NULL DEFAULT 0,
    table_sets JSONB NOT NULL DEFAULT '[]'::jsonb,
    deck_count INTEGER NOT NULL DEFAULT 0,
    pass_streak INTEGER NOT NULL DEFAULT 0,
    winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    end_reason TEXT CHECK (end_reason IN ('empty_hand', 'stuck', 'others_left')),
    turn_limit_sec INTEGER NOT NULL DEFAULT 90 CHECK (turn_limit_sec BETWEEN 30 AND 600),
    -- 낙관적 동시성 제어용. 갱신할 때마다 1씩 증가합니다.
    version INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    turn_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rummy_rooms_status ON public.rummy_rooms(status);

ALTER TABLE public.rummy_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rummy_rooms FROM anon, authenticated;
GRANT SELECT ON public.rummy_rooms TO authenticated;

-- 참여자 본인만 Realtime 구독(방 상태 변경 즉시 반영)용 SELECT 허용. 관전자는 서버 폴링으로 봅니다.
CREATE POLICY "rummy_rooms_select_participants" ON public.rummy_rooms FOR SELECT TO authenticated
USING (players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text)));

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rummy_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 손패 / 더미 (서버 전용) -------------------------------------------
CREATE TABLE IF NOT EXISTS public.rummy_hands (
    room_id UUID NOT NULL REFERENCES public.rummy_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tiles JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (room_id, user_id)
);
ALTER TABLE public.rummy_hands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rummy_hands FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.rummy_decks (
    room_id UUID PRIMARY KEY REFERENCES public.rummy_rooms(id) ON DELETE CASCADE,
    tiles JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.rummy_decks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rummy_decks FROM anon, authenticated;

-- 3. 방 채팅 (플레이어 + 관전자) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.rummy_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rummy_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT CHECK (author_role IN ('player', 'spectator')),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rummy_chat_room_created_at ON public.rummy_chat_messages(room_id, created_at);
ALTER TABLE public.rummy_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rummy_chat_messages FROM anon, authenticated;
GRANT SELECT ON public.rummy_chat_messages TO authenticated;
CREATE POLICY "rummy_chat_select_participants" ON public.rummy_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.rummy_rooms r
        WHERE r.id = room_id
          AND r.players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text))
    )
);
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rummy_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. 전적 / 누적 점수 랭킹 -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rummy_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rummy_rooms(id) ON DELETE CASCADE,
    -- [{ id, name, penalty, score }]
    players JSONB NOT NULL,
    winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    end_reason TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.rummy_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rummy_matches FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.rummy_ratings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    games INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    -- 승자는 다른 사람들의 남은 타일 벌점 합을 +, 패자는 자기 벌점을 − 로 누적합니다.
    points INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rummy_ratings_points ON public.rummy_ratings(points DESC);
ALTER TABLE public.rummy_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rummy_ratings FROM anon, authenticated;
