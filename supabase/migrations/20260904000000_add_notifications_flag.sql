-- ========================================================
-- 알림(새 팟 · 내 팟 채팅) 기능 플래그
--
-- 운영과 테스트가 같은 코드로 함께 배포되므로, 코드로 나누지 않고 DB 값으로
-- 켭니다. 기본값은 false라 이 마이그레이션이 운영에 적용돼도 알림은 꺼진
-- 채입니다. 테스트 서버 DB에서만 아래로 켭니다.
--
--   update public.app_flags set enabled = true where key = 'notifications';
--
-- 켜기 전까지 layout.tsx가 Provider를 매달지 않으므로 폴링도 Realtime 구독도
-- 시작되지 않습니다.
-- ========================================================

INSERT INTO public.app_flags (key, enabled)
VALUES ('notifications', false)
ON CONFLICT (key) DO NOTHING;
