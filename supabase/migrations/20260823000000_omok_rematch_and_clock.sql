-- ========================================================
-- 오목: 재대국 신청·수락(흑백 교대), 착수 시간 제한, 관전자 채팅
-- ========================================================
-- 컬럼 추가만 하므로 기존 RLS 정책과 role 권한은 그대로입니다.

-- 1. 착수 시간 제한 --------------------------------------------------
-- 현재 차례가 시작된 시각. 시간 초과 판정은 서버가 항상 이 값을 기준으로
-- 다시 계산하므로, 클라이언트 카운트다운은 표시용일 뿐입니다.
ALTER TABLE public.omok_rooms
    ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMPTZ;

-- 2. 재대국 신청 -----------------------------------------------------
-- 재대국을 신청한 사람. NULL이면 신청이 없는 상태입니다. 상대가 수락하기
-- 전까지 방은 계속 'finished'로 남아 있어, 한쪽이 몰래 새 판을 시작해
-- 상대의 '게임 나가기'가 기권으로 처리되던 문제가 생기지 않습니다.
ALTER TABLE public.omok_rooms
    ADD COLUMN IF NOT EXISTS rematch_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. 채팅 작성자 역할 --------------------------------------------------
-- 관전자도 채팅할 수 있게 되면서, 메시지마다 "그때 이 사람이 무슨 역할이
-- 었는지"를 남깁니다. 재대국 때 흑백이 교대되므로 조회 시점에 방의
-- black_id/white_id로 계산하면 지난 메시지의 표시가 뒤바뀝니다.
-- 기존 행은 NULL로 남고, 화면에서는 역할 표시가 생략됩니다.
ALTER TABLE public.omok_chat_messages
    ADD COLUMN IF NOT EXISTS author_role TEXT
    CHECK (author_role IN ('black', 'white', 'spectator'));
