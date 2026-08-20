-- ========================================================
-- 기능 플래그: DB 값으로 특정 기능을 켜고 끕니다.
--
-- 실서버와 테스트서버가 같은 코드로 함께 배포되는 상황에서, 발표 전까지
-- 미니게임 탭을 실서버에서는 숨기고 테스트서버 DB에서만 켜보고 싶을 때
-- 씁니다. 기본값은 항상 false(꺼짐)입니다 — 마이그레이션을 깜빡 안 돌린
-- 환경이나 조회 실패 시에도 안전하게 숨겨지도록 fail-closed로 설계했습니다.
-- ========================================================

CREATE TABLE IF NOT EXISTS public.app_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

-- 서버(API/서버 컴포넌트)에서 service_role로만 읽고 씁니다. 클라이언트가
-- 직접 켜고 끌 수 없습니다.
REVOKE ALL ON public.app_flags FROM anon, authenticated;

INSERT INTO public.app_flags (key, enabled)
VALUES ('games_hub', false)
ON CONFLICT (key) DO NOTHING;
