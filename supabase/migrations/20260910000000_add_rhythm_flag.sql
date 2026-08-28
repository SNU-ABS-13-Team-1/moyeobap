-- ========================================================
-- 리듬게임 전용 기능 플래그.
--
-- baduk·alkkagi 플래그와 같은 이유입니다. 방금 만든 리듬게임(실제 BGM
-- 채보)만 테스트서버에서 먼저 검증하고 싶기 때문입니다. 기본값은
-- false(꺼짐)이며, 테스트서버 DB에서만 켭니다.
--
--   update public.app_flags set enabled = true where key = 'rhythm';
-- ========================================================

INSERT INTO public.app_flags (key, enabled)
VALUES ('rhythm', false)
ON CONFLICT (key) DO NOTHING;
