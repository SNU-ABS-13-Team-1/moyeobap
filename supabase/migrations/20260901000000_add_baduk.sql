-- ========================================================
-- 실시간 바둑(19x19) 대전: 방, 방 채팅, 전적, ELO 랭킹
--
-- 오목(omok_*)·체스(chess_*)와 같은 구조입니다. 보드는 19x19 JSONB
-- 배열(오목과 동일 패턴, DB에 크기 제약은 없고 앱 상수 BOARD_SIZE=19로만
-- 관리)로 통째로 저장하고, 활로/따내기/자충수/패 판정은 서버가
-- badukRules.ts로 다시 계산합니다. 방장은 흑(black, 선수)이고 참여자는
-- 백(white, 덤을 받음)입니다. status에 오목/체스엔 없는 'scoring'
-- (계가 중, 두 번 연속 패스 후 죽은 돌을 표시하고 서로 동의하는 단계)이
-- 추가로 있습니다.
-- ========================================================

-- 1. 바둑 방 ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.baduk_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT '바둑 방',
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'scoring', 'finished')) DEFAULT 'waiting',
    black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT NOT NULL,
    white_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT,
    board JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 패(ko) 판정용: 직전 내 차례가 시작되기 전(상대가 두기 전) 보드.
    previous_board JSONB,
    turn TEXT NOT NULL DEFAULT 'black' CHECK (turn IN ('black', 'white')),
    move_count INTEGER NOT NULL DEFAULT 0,
    -- 연속 패스 횟수. 2에 도달하면 서버가 자동으로 status를 scoring으로 바꿉니다.
    pass_count INTEGER NOT NULL DEFAULT 0,
    captures_black INTEGER NOT NULL DEFAULT 0,
    captures_white INTEGER NOT NULL DEFAULT 0,
    -- 계가 중 "죽었다"고 표시된 돌들의 좌표("row,col" 문자열) 집합.
    dead_stones JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 계가 결과에 대한 동의 여부. dead_stones가 바뀌면 서버가 둘 다 false로 리셋합니다.
    black_confirmed_score BOOLEAN NOT NULL DEFAULT false,
    white_confirmed_score BOOLEAN NOT NULL DEFAULT false,
    winner TEXT CHECK (winner IN ('black', 'white')),
    final_black_score NUMERIC,
    final_white_score NUMERIC,
    last_row INTEGER,
    last_col INTEGER,
    started_at TIMESTAMPTZ,
    turn_started_at TIMESTAMPTZ,
    rematch_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baduk_rooms_status ON public.baduk_rooms(status);

ALTER TABLE public.baduk_rooms ENABLE ROW LEVEL SECURITY;

-- 방 생성/참여/착수는 서버(API)에서 service_role로만 처리합니다.
REVOKE ALL ON public.baduk_rooms FROM anon, authenticated;

-- Realtime 구독(상대의 수를 즉시 받아보는 용도)을 위해 참여자 본인에게만
-- SELECT를 허용합니다. 관전자는 서버 폴링으로 따라잡습니다.
GRANT SELECT ON public.baduk_rooms TO authenticated;

CREATE POLICY "baduk_rooms_select_participants" ON public.baduk_rooms FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = black_id OR (SELECT auth.uid()) = white_id);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.baduk_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 방 채팅 (플레이어 + 관전자 모두 참여) ---------------------------------
CREATE TABLE IF NOT EXISTS public.baduk_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.baduk_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT CHECK (author_role IN ('black', 'white', 'spectator')),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baduk_chat_room_created_at
    ON public.baduk_chat_messages(room_id, created_at);

ALTER TABLE public.baduk_chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.baduk_chat_messages FROM anon, authenticated;

GRANT SELECT ON public.baduk_chat_messages TO authenticated;

CREATE POLICY "baduk_chat_select_participants" ON public.baduk_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.baduk_rooms r
        WHERE r.id = room_id
          AND ((SELECT auth.uid()) = r.black_id OR (SELECT auth.uid()) = r.white_id)
    )
);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.baduk_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. 대국 전적 ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.baduk_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.baduk_rooms(id) ON DELETE CASCADE,
    black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT NOT NULL,
    white_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT NOT NULL,
    winner TEXT NOT NULL CHECK (winner IN ('black', 'white')),
    final_black_score NUMERIC NOT NULL,
    final_white_score NUMERIC NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baduk_matches_black ON public.baduk_matches(black_id);
CREATE INDEX IF NOT EXISTS idx_baduk_matches_white ON public.baduk_matches(white_id);

ALTER TABLE public.baduk_matches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.baduk_matches FROM anon, authenticated;

-- 4. ELO 랭킹 -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.baduk_ratings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1200,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    -- 덤이 6.5(정수 아님)라 무승부는 규칙상 나올 수 없지만, GameRanking
    -- 컴포넌트가 기대하는 모양(오목/체스와 동일)에 맞춰 컬럼은 유지합니다.
    draws INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baduk_ratings_rating ON public.baduk_ratings(rating DESC);

ALTER TABLE public.baduk_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.baduk_ratings FROM anon, authenticated;
