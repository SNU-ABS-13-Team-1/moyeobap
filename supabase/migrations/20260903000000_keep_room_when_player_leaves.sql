-- ========================================================
-- 한 사람이 나가도 방을 지우지 않고 그 자리만 비웁니다.
--
-- 지금까지 방을 만든 사람의 자리(오목 흑, 체스 백, 퐁 1P)는 NOT NULL이라
-- 비울 수 없었고, 그래서 방장이 나가면 방을 통째로 지우는 수밖에 없었습니다.
-- 남은 사람과 관전자가 그대로 이어서 둘 수 있도록 자리를 비울 수 있게 합니다.
-- 두 자리가 모두 비면(마지막 사람까지 나가면) 서버가 방을 삭제합니다.
-- ========================================================

ALTER TABLE public.omok_rooms
    ALTER COLUMN black_id DROP NOT NULL,
    ALTER COLUMN black_name DROP NOT NULL;

ALTER TABLE public.chess_rooms
    ALTER COLUMN white_id DROP NOT NULL,
    ALTER COLUMN white_name DROP NOT NULL;

ALTER TABLE public.pong_rooms
    ALTER COLUMN player1_id DROP NOT NULL,
    ALTER COLUMN player1_name DROP NOT NULL;
