-- ========================================================
-- 모여밥 (Moyeobap) Supabase PostgreSQL Database Schema
-- ========================================================

-- 1. 음식점 (restaurants) 테이블 생성
CREATE TABLE IF NOT EXISTS public.restaurants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🍱',
    category TEXT NOT NULL CHECK (category IN ('lunch', 'cafe')),
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 팟 참여자 (pot_participants) 테이블 생성
CREATE TABLE IF NOT EXISTS public.pot_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pot_id TEXT NOT NULL REFERENCES public.pots(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_initial TEXT NOT NULL,
    bank_account TEXT,
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
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'account')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_pots_status ON public.pots(status);
CREATE INDEX IF NOT EXISTS idx_pot_participants_pot_id ON public.pot_participants(pot_id);
CREATE INDEX IF NOT EXISTS idx_messages_pot_id ON public.messages(pot_id);

-- 6. RLS (Row Level Security) 설정
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pot_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 7. 기존 정책 안전 초기화 후 재등록
DO $$ 
BEGIN
    EXECUTE (
        SELECT string_agg('DROP POLICY IF EXISTS ' || quote_ident(policyname) || ' ON ' || quote_ident(tablename) || ';', ' ')
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN ('restaurants', 'pots', 'pot_participants', 'messages')
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Allow public select restaurants" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Allow public insert restaurants" ON public.restaurants FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public select pots" ON public.pots FOR SELECT USING (true);
CREATE POLICY "Allow public insert pots" ON public.pots FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update pots" ON public.pots FOR UPDATE USING (true);

CREATE POLICY "Allow public select pot_participants" ON public.pot_participants FOR SELECT USING (true);
CREATE POLICY "Allow public insert pot_participants" ON public.pot_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete pot_participants" ON public.pot_participants FOR DELETE USING (true);

CREATE POLICY "Allow public select messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert messages" ON public.messages FOR INSERT WITH CHECK (true);

-- 8. Supabase Realtime 설정 (오류 발생 시 자동 무시)
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
