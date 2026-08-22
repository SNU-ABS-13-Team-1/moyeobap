-- ========================================================
-- 실시간 체스 대전: 방, 방 채팅, 전적, ELO 랭킹
--
-- 오목(omok_*)과 같은 구조입니다. 보드 대신 FEN(현재 국면 문자열)과 수순
-- (SAN 배열)을 저장하고, 규칙 판정은 서버가 chess.js로 다시 계산합니다.
-- 방장은 백(white, 선수)이고 참여자는 흑(black)입니다.
-- ========================================================

-- 1. 체스 방 ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chess_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT '체스 방',
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
    white_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT NOT NULL,
    black_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT,
    fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves JSONB NOT NULL DEFAULT '[]'::jsonb,
    turn TEXT NOT NULL DEFAULT 'w' CHECK (turn IN ('w', 'b')),
    winner TEXT CHECK (winner IN ('white', 'black', 'draw')),
    end_reason TEXT CHECK (end_reason IN ('checkmate', 'stalemate', 'threefold', 'insufficient', 'fifty_move', 'resign', 'timeout', 'disconnect')),
    move_count INTEGER NOT NULL DEFAULT 0,
    last_from TEXT,
    last_to TEXT,
    started_at TIMESTAMPTZ,
    turn_started_at TIMESTAMPTZ,
    rematch_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chess_rooms_status ON public.chess_rooms(status);

ALTER TABLE public.chess_rooms ENABLE ROW LEVEL SECURITY;

-- 방 생성/참여/착수는 서버(API)에서 service_role로만 처리합니다.
REVOKE ALL ON public.chess_rooms FROM anon, authenticated;

-- Realtime 구독(상대의 수를 즉시 받아보는 용도)을 위해 참여자 본인에게만
-- SELECT를 허용합니다. 관전자는 서버 폴링으로 따라잡습니다.
GRANT SELECT ON public.chess_rooms TO authenticated;

CREATE POLICY "chess_rooms_select_participants" ON public.chess_rooms FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = white_id OR (SELECT auth.uid()) = black_id);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 방 채팅 (플레이어 + 관전자 모두 참여) ---------------------------------
CREATE TABLE IF NOT EXISTS public.chess_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.chess_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT CHECK (author_role IN ('white', 'black', 'spectator')),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chess_chat_room_created_at
    ON public.chess_chat_messages(room_id, created_at);

ALTER TABLE public.chess_chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chess_chat_messages FROM anon, authenticated;

GRANT SELECT ON public.chess_chat_messages TO authenticated;

CREATE POLICY "chess_chat_select_participants" ON public.chess_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.chess_rooms r
        WHERE r.id = room_id
          AND ((SELECT auth.uid()) = r.white_id OR (SELECT auth.uid()) = r.black_id)
    )
);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. 대국 전적 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chess_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.chess_rooms(id) ON DELETE CASCADE,
    white_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT NOT NULL,
    black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT NOT NULL,
    winner TEXT NOT NULL CHECK (winner IN ('white', 'black', 'draw')),
    end_reason TEXT,
    move_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chess_matches_white ON public.chess_matches(white_id);
CREATE INDEX IF NOT EXISTS idx_chess_matches_black ON public.chess_matches(black_id);

ALTER TABLE public.chess_matches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chess_matches FROM anon, authenticated;

-- 4. ELO 랭킹 -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chess_ratings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1200,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chess_ratings_rating ON public.chess_ratings(rating DESC);

ALTER TABLE public.chess_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chess_ratings FROM anon, authenticated;
