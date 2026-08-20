-- ========================================================
-- 실시간 오목 대전 방
-- ========================================================

CREATE TABLE IF NOT EXISTS public.omok_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
    black_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    black_name TEXT NOT NULL,
    white_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    white_name TEXT,
    board JSONB NOT NULL DEFAULT '[]'::jsonb,
    turn TEXT NOT NULL DEFAULT 'black' CHECK (turn IN ('black', 'white')),
    winner TEXT CHECK (winner IN ('black', 'white', 'draw')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_omok_rooms_status ON public.omok_rooms(status);

ALTER TABLE public.omok_rooms ENABLE ROW LEVEL SECURITY;

-- 방 생성/참여/착수는 서버(API)에서 service_role로만 처리합니다.
REVOKE ALL ON public.omok_rooms FROM anon, authenticated;

-- Realtime 구독(대국 중인 두 사람이 상대방의 착수를 즉시 받아보는 용도)을 위해
-- 참여자 본인에게만 SELECT를 허용합니다. 대기실 목록은 이 정책과 무관하게
-- 서버가 service_role로 조회해 내려줍니다.
GRANT SELECT ON public.omok_rooms TO authenticated;

CREATE POLICY "omok_rooms_select_participants" ON public.omok_rooms FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = black_id OR (SELECT auth.uid()) = white_id);

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.omok_rooms;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
