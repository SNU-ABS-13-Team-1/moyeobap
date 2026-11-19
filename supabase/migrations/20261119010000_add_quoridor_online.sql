-- ========================================================
-- 쿼리도 온라인 대전(2인·4인): 방, 방 채팅, 전적, 주간 ELO 랭킹
--
-- 루미큐브 온라인(rummy_*)과 같은 뼈대입니다. 숨긴 정보가 없어 손패·더미 같은
-- 서버 전용 표는 없고, 판 상태를 방 행에 그대로 둡니다.
--
--   players    [{ id, name, seat, left, timeouts }] 시작 후에는 seat 순(turn_index === seat)
--   pawns      [{ r, c }] seat 순
--   walls      [{ r, c, o: 'h'|'v' }]
--   walls_left [n, ...] seat 순
--   moves      [{ seat, move }] 기보(표기 "e2"·"e3h", 'pass', 'timeout')
--
-- 모든 갱신은 서버(API)가 service_role로 하며 version 조건으로 낙관적 잠금을 겁니다.
-- 다시 실행해도 안전하도록 IF NOT EXISTS / DROP POLICY IF EXISTS를 씁니다.
-- ========================================================

-- 1. 방 ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quoridor_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT '쿼리도 방',
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mode SMALLINT NOT NULL CHECK (mode IN (2, 4)),
    players JSONB NOT NULL DEFAULT '[]'::jsonb,
    turn_index INTEGER NOT NULL DEFAULT 0,
    pawns JSONB NOT NULL DEFAULT '[]'::jsonb,
    walls JSONB NOT NULL DEFAULT '[]'::jsonb,
    walls_left JSONB NOT NULL DEFAULT '[]'::jsonb,
    moves JSONB NOT NULL DEFAULT '[]'::jsonb,
    winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    end_reason TEXT CHECK (end_reason IN ('goal', 'others_left')),
    turn_limit_sec INTEGER NOT NULL DEFAULT 60 CHECK (turn_limit_sec BETWEEN 30 AND 600),
    -- 낙관적 동시성 제어용. 갱신할 때마다 1씩 증가합니다.
    version INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    turn_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quoridor_rooms_status ON public.quoridor_rooms(status);

ALTER TABLE public.quoridor_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quoridor_rooms FROM anon, authenticated;
GRANT SELECT ON public.quoridor_rooms TO authenticated;

-- 참여자 본인만 Realtime 구독(방 상태 변경 즉시 반영)용 SELECT 허용. 관전자는 서버 폴링으로 봅니다.
DROP POLICY IF EXISTS "quoridor_rooms_select_participants" ON public.quoridor_rooms;
CREATE POLICY "quoridor_rooms_select_participants" ON public.quoridor_rooms FOR SELECT TO authenticated
USING (players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text)));

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quoridor_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 방 채팅 (플레이어 + 관전자) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.quoridor_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.quoridor_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT CHECK (author_role IN ('player', 'spectator')),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quoridor_chat_room_created_at ON public.quoridor_chat_messages(room_id, created_at);
ALTER TABLE public.quoridor_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quoridor_chat_messages FROM anon, authenticated;
GRANT SELECT ON public.quoridor_chat_messages TO authenticated;
DROP POLICY IF EXISTS "quoridor_chat_select_participants" ON public.quoridor_chat_messages;
CREATE POLICY "quoridor_chat_select_participants" ON public.quoridor_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.quoridor_rooms r
        WHERE r.id = room_id
          AND r.players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text))
    )
);
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quoridor_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. 전적 -------------------------------------------------------------
-- 방은 1시간 움직임이 없으면 지워지지만 전적은 남아야 하므로 room_id는 SET NULL입니다.
CREATE TABLE IF NOT EXISTS public.quoridor_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.quoridor_rooms(id) ON DELETE SET NULL,
    mode SMALLINT NOT NULL CHECK (mode IN (2, 4)),
    -- [{ id, name, seat, left, ratingBefore, ratingAfter }]
    players JSONB NOT NULL,
    winner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    end_reason TEXT,
    moves JSONB NOT NULL DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- 같은 판이 두 번 기록(랭킹 이중 반영)되지 않게 막습니다.
    UNIQUE (room_id, started_at)
);
ALTER TABLE public.quoridor_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quoridor_matches FROM anon, authenticated;

-- 4. 주간 ELO 랭킹 ----------------------------------------------------
-- 알까기와 같은 주간 테이블입니다(K=32, 시작 1200, 매주 월요일 KST에 새로 시작).
-- 쿼리도는 무승부가 없어 draws를 두지 않습니다. 지난주 상위 3명은 game_week_hall에 남습니다.
CREATE TABLE IF NOT EXISTS public.quoridor_ratings (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_key TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1200,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, week_key)
);
CREATE INDEX IF NOT EXISTS idx_quoridor_ratings_rating ON public.quoridor_ratings(rating DESC);
CREATE INDEX IF NOT EXISTS idx_quoridor_ratings_week ON public.quoridor_ratings(week_key);
ALTER TABLE public.quoridor_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quoridor_ratings FROM anon, authenticated;
