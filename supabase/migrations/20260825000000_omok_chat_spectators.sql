-- ========================================================
-- 오목 방 채팅: 관전자도 참여할 수 있도록 Realtime 구독 범위 확장
--
-- 이제 흑/백뿐 아니라 관전자도 채팅을 쓸 수 있습니다(검증은 서버 API,
-- app/lib/omokChat.ts에서 합니다). 기존 정책은 참여자(흑/백)에게만
-- SELECT를 허용해서, 관전자는 새 메시지를 3초 polling으로만 받고
-- Realtime으로는 못 받았습니다. 방 자체(omok_rooms)의 조회는 이미
-- service_role을 통해 로그인한 모든 사용자에게 열려 있어 관전이
-- 가능하므로, 채팅 SELECT 정책도 그 실제 접근 범위에 맞춰 로그인한
-- 모든 사용자로 넓힙니다.
-- ========================================================

DROP POLICY IF EXISTS "omok_chat_select_participants" ON public.omok_chat_messages;

CREATE POLICY "omok_chat_select_authenticated" ON public.omok_chat_messages FOR SELECT TO authenticated
USING (true);
