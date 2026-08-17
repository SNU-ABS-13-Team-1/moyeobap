-- ========================================================
-- 모여밥 (Moyeobap) Supabase PostgreSQL Database Schema
-- ========================================================

-- 1. 음식점 (restaurants) 테이블 생성
CREATE TABLE IF NOT EXISTS public.restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🍱',
    category TEXT NOT NULL CHECK (category IN ('lunch', 'cafe', 'other')),
    sub_category TEXT,
    min_order INTEGER NOT NULL DEFAULT 0,
    delivery_time TEXT NOT NULL DEFAULT '30~40분',
    menus JSONB NOT NULL DEFAULT '[]'::jsonb,
    address TEXT,
    phone TEXT,
    business_hours TEXT,
    closed_days TEXT,
    rating NUMERIC(3, 1) DEFAULT 5.0,
    is_custom BOOLEAN NOT NULL DEFAULT FALSE,
    is_one_time BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 팟 (pots) 테이블 생성 (생성자 및 현재 관리자 포함)
CREATE TABLE IF NOT EXISTS public.pots (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'closed', 'failed')) DEFAULT 'active',
    max_participants INTEGER,
    creator_id TEXT,
    manager_id TEXT,
    order_completed_at TIMESTAMPTZ,
    order_completed_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pots
    ADD COLUMN IF NOT EXISTS order_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS order_completed_by TEXT;

-- 3. 팟 참여자 (pot_participants) 테이블 생성
CREATE TABLE IF NOT EXISTS public.pot_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pot_id TEXT NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_initial TEXT NOT NULL,
    bank_account TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_pot_participant UNIQUE (pot_id, user_id)
);

-- 4. 팟 대화 메시지 (messages) 테이블 생성
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pot_id TEXT NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    text TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'account', 'order_link', 'image')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 참여자별 마지막 채팅 읽음 시각
CREATE TABLE IF NOT EXISTS public.message_reads (
    pot_id TEXT NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_read_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (pot_id, user_id)
);

-- 6. 사용자 피드백
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) BETWEEN 5 AND 1000),
    page_path TEXT CHECK (page_path IS NULL OR char_length(page_path) <= 200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_pots_status ON public.pots(status);
CREATE INDEX IF NOT EXISTS idx_pot_participants_pot_id ON public.pot_participants(pot_id);
CREATE INDEX IF NOT EXISTS idx_messages_pot_id ON public.messages(pot_id);
CREATE INDEX IF NOT EXISTS idx_messages_pot_created_at ON public.messages(pot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- 8. RLS (Row Level Security) 설정
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pot_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_pot_participant(target_pot_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.pot_participants
        WHERE pot_id = target_pot_id
          AND user_id = (SELECT auth.uid())::TEXT
    );
$$;

REVOKE ALL ON FUNCTION public.is_pot_participant(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pot_participant(TEXT) TO authenticated;

-- 9. 기존 정책 안전 초기화 후 재등록
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', ' ')
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN ('restaurants', 'pots', 'pot_participants', 'messages', 'message_reads', 'feedback')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "messages_select_participants" ON public.messages FOR SELECT TO authenticated
USING (public.is_pot_participant(pot_id));

CREATE POLICY "message_reads_select_own" ON public.message_reads FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "message_reads_insert_own" ON public.message_reads FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "message_reads_update_own" ON public.message_reads FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "feedback_insert_own" ON public.feedback FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE ON public.message_reads TO authenticated;
GRANT INSERT ON public.feedback TO authenticated;

REVOKE ALL ON public.restaurants FROM anon, authenticated;
REVOKE ALL ON public.pots FROM anon, authenticated;
REVOKE ALL ON public.pot_participants FROM anon, authenticated;
REVOKE ALL ON public.messages FROM anon, authenticated;
GRANT SELECT ON public.messages TO authenticated;

-- 10. Supabase Realtime 설정 (오류 발생 시 자동 무시)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pots;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pot_participants;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
