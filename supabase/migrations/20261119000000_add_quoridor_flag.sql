-- ========================================================
-- 쿼리도 전용 기능 플래그.
--
-- 테스트 서버 없이 운영 DB에 바로 적용하고, 기본값 false(꺼짐)로 숨긴 채
-- 머지·배포합니다. 배포 뒤 운영에서 켜고 확인하며, 문제가 있으면 다시 끕니다.
--
--   update public.app_flags set enabled = true where key = 'quoridor';
-- ========================================================

INSERT INTO public.app_flags (key, enabled)
VALUES ('quoridor', false)
ON CONFLICT (key) DO NOTHING;
