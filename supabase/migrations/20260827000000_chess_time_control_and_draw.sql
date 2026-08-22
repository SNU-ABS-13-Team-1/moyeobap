-- ========================================================
-- 체스 대전: 시간제 선택(한 수 60초 / 총 5·10·15분 / 제한 없음)과 합의 무승부
-- ========================================================

ALTER TABLE public.chess_rooms
    ADD COLUMN IF NOT EXISTS time_control TEXT NOT NULL DEFAULT 'move60',
    -- 총 시간제에서 각자 남은 시간(ms). 한 수 제한/무제한이면 NULL.
    ADD COLUMN IF NOT EXISTS white_time_ms INTEGER,
    ADD COLUMN IF NOT EXISTS black_time_ms INTEGER,
    -- 무승부를 제안한 사람. NULL이면 제안 없음. 상대가 수락하면 합의 무승부로 종료.
    ADD COLUMN IF NOT EXISTS draw_offer_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.chess_rooms DROP CONSTRAINT IF EXISTS chess_rooms_time_control_check;
ALTER TABLE public.chess_rooms
    ADD CONSTRAINT chess_rooms_time_control_check
    CHECK (time_control IN ('move60', 'total5', 'total10', 'total15', 'none'));

ALTER TABLE public.chess_rooms DROP CONSTRAINT IF EXISTS chess_rooms_end_reason_check;
ALTER TABLE public.chess_rooms
    ADD CONSTRAINT chess_rooms_end_reason_check
    CHECK (end_reason IN ('checkmate', 'stalemate', 'threefold', 'insufficient', 'fifty_move', 'resign', 'timeout', 'disconnect', 'agreement'));
