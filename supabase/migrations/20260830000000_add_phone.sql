-- ========================================================
-- 갈틱폰(3~10명): 방, 앨범 칸(글·그림), 채팅
--
-- 방(phone_rooms)에는 모두가 봐도 되는 진행 정보만 둡니다(턴, 제출한 사람, 공개 진행 위치).
-- 앨범의 칸(phone_entries)은 서버(API)만 읽고 씁니다 — 진행 중에는 "내가 받은 앞 칸 하나"만,
-- 공개 단계에는 방장이 넘긴 데까지만 내려줘야 하기 때문입니다(익명성·스포일러 방지).
-- ========================================================

-- 1. 방 ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.phone_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT '갈틱폰 방',
    -- waiting(대기) → playing(턴 진행) → presenting(앨범 공개). 한 판 더 하면 waiting으로 돌아갑니다.
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'presenting')) DEFAULT 'waiting',
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- [{ id, name, avatarUrl?, left }] 참여 순서대로(최대 10명). 시작 뒤에는 순서가 고정됩니다.
    players JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- { writeSec, drawSec }
    settings JSONB NOT NULL DEFAULT '{"writeSec": 40, "drawSec": 90}'::jsonb,
    -- 현재 턴(1부터). 홀수 턴 = 글, 짝수 턴 = 그림.
    turn INTEGER NOT NULL DEFAULT 0,
    total_turns INTEGER NOT NULL DEFAULT 0,
    -- 이번 턴에 제출한 사람 id 목록
    submitted JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 공개 단계 진행 위치 { album, step } — 모든 화면이 이 값을 따라갑니다.
    reveal JSONB NOT NULL DEFAULT '{"album": 0, "step": 0}'::jsonb,
    -- 낙관적 동시성 제어용. 갱신할 때마다 1씩 증가합니다.
    version INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    turn_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_rooms_status ON public.phone_rooms(status);

ALTER TABLE public.phone_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_rooms FROM anon, authenticated;
GRANT SELECT ON public.phone_rooms TO authenticated;

-- 참여자 본인만 Realtime 구독(방 상태 변경 즉시 반영)용 SELECT 허용.
CREATE POLICY "phone_rooms_select_participants" ON public.phone_rooms FOR SELECT TO authenticated
USING (players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text)));

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.phone_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 앨범 칸 (서버 전용) -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.phone_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.phone_rooms(id) ON DELETE CASCADE,
    -- 앨범은 첫 문장을 쓴 사람(주인)으로 구분합니다.
    album_owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    turn INTEGER NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('text', 'draw')),
    text TEXT,
    -- 그림은 PNG data URL. 팟 채팅 사진과 같은 방식으로 DB에 둡니다(판이 쌓이면 Storage로 이전).
    image TEXT,
    -- ok | timeout(시간 초과로 자동 제출) | left(자리 비움)
    status TEXT NOT NULL CHECK (status IN ('ok', 'timeout', 'left')) DEFAULT 'ok',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (room_id, album_owner_id, turn)
);
CREATE INDEX IF NOT EXISTS idx_phone_entries_room ON public.phone_entries(room_id, album_owner_id, turn);
ALTER TABLE public.phone_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_entries FROM anon, authenticated;

-- 3. 방 채팅 -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.phone_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.phone_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT CHECK (author_role IN ('player', 'spectator')),
    text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_phone_chat_room_created_at ON public.phone_chat_messages(room_id, created_at);
ALTER TABLE public.phone_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_chat_messages FROM anon, authenticated;
GRANT SELECT ON public.phone_chat_messages TO authenticated;
CREATE POLICY "phone_chat_select_participants" ON public.phone_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.phone_rooms r
        WHERE r.id = room_id
          AND r.players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text))
    )
);
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.phone_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
