-- ========================================================
-- 알까기 전용 기능 플래그.
--
-- baduk 플래그와 같은 이유입니다. 다른 미니게임은 이미 실서버에 공개돼
-- 있는데, 방금 만든 알까기만 테스트서버에서 먼저 검증하고 싶기 때문입니다.
-- 기본값은 false(꺼짐)이며, 테스트서버 DB에서만 켭니다.
--
--   update public.app_flags set enabled = true where key = 'alkkagi';
-- ========================================================

INSERT INTO public.app_flags (key, enabled)
VALUES ('alkkagi', false)
ON CONFLICT (key) DO NOTHING;
