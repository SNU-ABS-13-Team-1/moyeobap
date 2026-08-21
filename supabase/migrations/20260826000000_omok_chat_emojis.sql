-- ========================================================
-- 오목 방 채팅에 모여밥 이모티콘 지원 추가
--
-- 팟 채팅(messages 테이블)과 동일하게, 이모티콘 메시지는 kind='image'로
-- 표시하고 실제 이미지 경로는 별도 컬럼 없이 text 컬럼에 그대로 저장합니다
-- (app/lib/omokChat.ts 참고). 이모티콘 목록 자체는 서버가 이미 화이트
-- 리스트(app/data/chat-emojis.ts)로 검증하므로 새 테이블/컬럼은 이거 하나면
-- 충분합니다.
-- ========================================================

ALTER TABLE public.omok_chat_messages
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image'));
