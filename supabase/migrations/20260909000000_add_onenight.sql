-- ========================================================
-- 원나잇 인랑(3~8명): 방, 밤에 나눠 준 카드, 채팅
--
-- 이 게임은 "누가 무슨 카드인지"가 전부입니다. 그래서 카드는 방 테이블에
-- 절대 두지 않습니다 — 방(onenight_rooms)은 참여자가 Realtime으로 구독해야
-- 해서 SELECT를 열어 두는데, 거기에 카드가 있으면 앱 화면에서 안 보여줘도
-- DB를 직접 구독해 전부 읽을 수 있기 때문입니다.
--
-- 카드·밤 행동·투표는 서버(API)만 읽고 쓰는 onenight_deals에 둡니다.
-- 각자에게는 자기 몫만 계산해서 내려줍니다. 갈틱폰의 phone_entries와 같은 경계입니다.
-- ========================================================

-- 1. 방 ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onenight_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_name TEXT NOT NULL DEFAULT '원나잇 인랑 방',
    -- waiting(대기) → night(밤) → day(토론) → voting(투표) → finished(결과).
    -- 한 판 더 하면 waiting으로 돌아갑니다.
    status TEXT NOT NULL CHECK (status IN ('waiting', 'night', 'day', 'voting', 'finished')) DEFAULT 'waiting',
    host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- [{ id, name, avatarUrl?, left }] 참여 순서대로(최대 8명). 시작 뒤 순서가 고정됩니다.
    players JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- { nightSec, daySec, voteSec }
    settings JSONB NOT NULL DEFAULT '{"nightSec": 45, "daySec": 180, "voteSec": 30}'::jsonb,
    -- 밤 행동을 낸 사람 / 투표를 마친 사람. "누가 아직 안 냈는지"만 공개하고
    -- 무엇을 냈는지는 담지 않습니다.
    night_submitted JSONB NOT NULL DEFAULT '[]'::jsonb,
    voted JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 끝난 판의 전체 공개 정보(카드·투표·승패). status='finished'일 때만 채웁니다.
    result JSONB,
    -- 낙관적 동시성 제어용. 갱신할 때마다 1씩 증가합니다.
    version INTEGER NOT NULL DEFAULT 0,
    -- 현재 단계가 시작된 시각. 남은 시간은 이 값 + settings로 계산합니다.
    phase_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onenight_rooms_status ON public.onenight_rooms(status);

ALTER TABLE public.onenight_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onenight_rooms FROM anon, authenticated;
GRANT SELECT ON public.onenight_rooms TO authenticated;

-- 참여자 본인만 Realtime 구독(방 상태 변경 즉시 반영)용 SELECT 허용.
CREATE POLICY "onenight_rooms_select_participants" ON public.onenight_rooms FOR SELECT TO authenticated
USING (players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text)));

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.onenight_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. 나눠 준 카드와 밤 행동 (서버 전용) -----------------------------------
-- 한 방에 한 줄. 한 판 더 하면 덮어씁니다.
CREATE TABLE IF NOT EXISTS public.onenight_deals (
    room_id UUID PRIMARY KEY REFERENCES public.onenight_rooms(id) ON DELETE CASCADE,
    -- 자리 순서 = onenight_rooms.players의 순서.
    seat_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 처음 나눠 준 카드. 밤 행동의 주체를 정합니다.
    start_roles JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 중앙 3장(밤 시작 시점).
    start_center JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 밤이 끝난 뒤의 실제 카드. 승패는 이걸로 판정합니다.
    final_roles JSONB,
    final_center JSONB,
    -- 자리별 밤 행동 [{...} | null]
    night_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- 자리별 밤 결과(각자에게 자기 것만 내려줍니다)
    knowledge JSONB,
    -- 자리별 투표 [자리번호 | null]
    votes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.onenight_deals ENABLE ROW LEVEL SECURITY;
-- 정책을 하나도 만들지 않습니다. service_role(서버)만 접근할 수 있습니다.
REVOKE ALL ON public.onenight_deals FROM anon, authenticated;

-- 3. 방 채팅 -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onenight_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.onenight_rooms(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT CHECK (author_role IN ('player', 'spectator')),
    text TEXT NOT NULL,
    -- 모여밥 이모티콘 메시지는 'image'. 다른 게임 채팅과 같은 형태입니다.
    kind TEXT NOT NULL CHECK (kind IN ('text', 'image')) DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onenight_chat_room ON public.onenight_chat_messages(room_id, created_at);

ALTER TABLE public.onenight_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.onenight_chat_messages FROM anon, authenticated;
GRANT SELECT ON public.onenight_chat_messages TO authenticated;

CREATE POLICY "onenight_chat_select_participants" ON public.onenight_chat_messages FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.onenight_rooms r
        WHERE r.id = room_id
          AND r.players @> jsonb_build_array(jsonb_build_object('id', (SELECT auth.uid())::text))
    )
);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.onenight_chat_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. 기능 플래그 --------------------------------------------------------------
-- 새 게임이라 테스트서버에서 먼저 돌려 봅니다. 바둑과 같은 방식입니다.
INSERT INTO public.app_flags (key, enabled)
VALUES ('onenight', false)
ON CONFLICT (key) DO NOTHING;
