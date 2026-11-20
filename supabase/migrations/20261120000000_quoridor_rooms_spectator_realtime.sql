-- ========================================================
-- 쿼리도 관전자도 방 상태를 실시간(Realtime)으로 받게 합니다.
--
-- Realtime postgres_changes는 구독자가 SELECT할 수 있는 행만 보내 줍니다.
-- 지금까지 SELECT를 참여자에게만 허용해서 관전자는 이벤트를 못 받고
-- 20초 폴링으로만 화면이 바뀌었습니다.
--
-- 방 조회 API(GET /api/games/quoridor/rooms/[id])는 이미 로그인한 누구에게나
-- 같은 행 전체(players 이름 포함)를 돌려주므로, 로그인 사용자 전체에 SELECT를
-- 열어도 새로 드러나는 정보는 없습니다. 쓰기는 계속 서버(service_role)만 합니다.
-- 채팅(quoridor_chat_messages)은 그대로 참여자 전용입니다.
--
-- 다시 실행해도 안전합니다.
-- ========================================================

DROP POLICY IF EXISTS "quoridor_rooms_select_participants" ON public.quoridor_rooms;
DROP POLICY IF EXISTS "quoridor_rooms_select_authenticated" ON public.quoridor_rooms;
CREATE POLICY "quoridor_rooms_select_authenticated" ON public.quoridor_rooms FOR SELECT TO authenticated
USING (true);
