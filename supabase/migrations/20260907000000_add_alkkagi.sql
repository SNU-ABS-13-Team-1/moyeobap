-- ========================================================
-- 실시간 알까기 대전: 방, 방 채팅, 전적, 주간 ELO 랭킹
--
-- 오목(omok_*)·바둑(baduk_*)과 같은 4종 구조입니다. 다른 점은 판 상태를
-- 격자 배열이 아니라 **돌의 좌표 배열**로 저장한다는 것뿐입니다.
--
--   stones          살아있는 돌만 [{ id, owner, x, y }]. 떨어진 돌은 배열에서
--                   빠지므로 배열 길이가 곧 남은 돌 수입니다.
--   pre_shot_stones 직전 샷을 쏘기 "전"의 배치
--   last_shot       { stoneId, vx, vy }
--   last_shot_at    발사 시각. 상대 화면이 "이미 지난 시간만큼 건너뛰고"
--                   이어서 재생하는 데 씁니다.
--   shot_seq        샷마다 +1. 클라이언트가 "이 샷을 이미 봤나" 판단하는
--                   표식이자, /shoot의 낙관적 동시성 제어 조건입니다.
--
-- pre_shot_stones + last_shot이 재생 필름입니다. 물리는 서버가 확정하고
-- (app/lib/alkkagiPhysics.ts), 클라이언트는 같은 순수 모듈로 굴러가는 장면만
-- 그린 뒤 stones로 스냅합니다. 프레임 좌표는 저장하지도 방송하지도 않습니다.
--
-- 알까기는 마지막 돌끼리 같이 떨어질 수 있어 winner에 'draw'가 있습니다.
-- ========================================================

-- 1. 알까기 방 ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alkkagi_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT '알까기 방',
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
    black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT NOT NULL,
    white_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT,
    stones JSONB NOT NULL DEFAULT '[]'::jsonb,
    pre_shot_stones JSONB,
    last_shot JSONB,
    last_shot_at TIMESTAMPTZ,
    shot_seq INTEGER NOT NULL DEFAULT 0,
    shot_count INTEGER NOT NULL DEFAULT 0,
    turn TEXT NOT NULL DEFAULT 'black' CHECK (turn IN ('black', 'white')),
    winner TEXT CHECK (winner IN ('black', 'white', 'draw')),
    started_at TIMESTAMPTZ,
    -- 돌이 다 멈추는 시각(미래)이 찍힙니다. 자세한 이유는 app/lib/alkkagiMatch.ts.
    turn_started_at TIMESTAMPTZ,
    rematch_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alkkagi_rooms_status ON public.alkkagi_rooms(status);

ALTER TABLE public.alkkagi_rooms ENABLE ROW LEVEL SECURITY;

-- 방 생성/참여/발사는 서버(API)에서 service_role로만 처리합니다.
REVOKE ALL ON public.alkkagi_rooms FROM anon, authenticated;

-- Realtime 구독(상대의 샷을 즉시 받아보는 용도)을 위해 참여자 본인에게만
-- SELECT를 허용합니다. 관전자는 서버 폴링으로 따라잡습니다.
GRANT SELECT ON public.alkkagi_rooms TO authenticated;

CREATE POLICY "alkkagi_rooms_select_participants" ON public.alkkagi_rooms FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = black_id OR (SELECT auth.uid()) = white_id);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alkkagi_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 방 채팅 (플레이어 + 관전자 모두 참여) ---------------------------------
CREATE TABLE IF NOT EXISTS public.alkkagi_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.alkkagi_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT CHECK (author_role IN ('black', 'white', 'spectator')),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    -- 모여밥 이모티콘은 kind='image'로 두고 경로를 text에 그대로 담습니다
    -- (20260905000000_game_chat_emojis.sql과 같은 형태).
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alkkagi_chat_room_created_at
    ON public.alkkagi_chat_messages(room_id, created_at);

ALTER TABLE public.alkkagi_chat_messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.alkkagi_chat_messages FROM anon, authenticated;

GRANT SELECT ON public.alkkagi_chat_messages TO authenticated;

CREATE POLICY "alkkagi_chat_select_participants" ON public.alkkagi_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.alkkagi_rooms r
        WHERE r.id = room_id
          AND ((SELECT auth.uid()) = r.black_id OR (SELECT auth.uid()) = r.white_id)
    )
);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alkkagi_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. 대국 전적 ----------------------------------------------------------
-- black_left / white_left는 끝났을 때 남은 돌 수입니다. 나중에 전적을 읽을 때
-- 얼마나 아슬아슬했는지가 보입니다(5-0인지 1-0인지).
CREATE TABLE IF NOT EXISTS public.alkkagi_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.alkkagi_rooms(id) ON DELETE CASCADE,
    black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT NOT NULL,
    white_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT NOT NULL,
    winner TEXT NOT NULL CHECK (winner IN ('black', 'white', 'draw')),
    black_left INTEGER NOT NULL,
    white_left INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alkkagi_matches_black ON public.alkkagi_matches(black_id);
CREATE INDEX IF NOT EXISTS idx_alkkagi_matches_white ON public.alkkagi_matches(white_id);

ALTER TABLE public.alkkagi_matches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.alkkagi_matches FROM anon, authenticated;

-- 4. 주간 ELO 랭킹 ---------------------------------------------------------
-- 20260831000000_weekly_rankings.sql에서 오목·체스·퐁·루미에 붙인 주 키를
-- 처음부터 갖고 시작합니다. 매주 월요일(KST) 1200점에서 다시 시작하고,
-- 지난주 상위 3명은 game_week_hall에 남습니다.
CREATE TABLE IF NOT EXISTS public.alkkagi_ratings (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_key TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL DEFAULT 1200,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, week_key)
);

CREATE INDEX IF NOT EXISTS idx_alkkagi_ratings_rating ON public.alkkagi_ratings(rating DESC);
CREATE INDEX IF NOT EXISTS idx_alkkagi_ratings_week ON public.alkkagi_ratings(week_key);

ALTER TABLE public.alkkagi_ratings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.alkkagi_ratings FROM anon, authenticated;
