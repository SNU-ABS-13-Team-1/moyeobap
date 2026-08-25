-- ========================================================
-- 오목 외 나머지 게임 채팅에도 모여밥 이모티콘 지원 추가
--
-- 오목에 넣었던 20260828000000_omok_chat_emojis.sql과 같은 형태입니다:
-- 이모티콘 메시지는 kind='image'로 표시하고, 실제 이미지 경로는 별도
-- 컬럼 없이 text 컬럼에 그대로 저장합니다. 이모티콘 ID → 실제 경로
-- 화이트리스트 검증은 서버(app/lib/gameChatBody.ts)에서 합니다.
--
-- DEFAULT 'text'라 기존 메시지는 전부 일반 텍스트로 남습니다.
--
-- 주의: 이 마이그레이션을 적용하지 않은 DB에서는 이모티콘 전송이 실패합니다
-- (kind 컬럼이 없어 INSERT가 거부됨). 코드 배포보다 먼저 적용하세요.
-- ========================================================

ALTER TABLE public.chess_chat_messages
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image'));

ALTER TABLE public.baduk_chat_messages
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image'));

ALTER TABLE public.pong_chat_messages
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image'));

ALTER TABLE public.rummy_chat_messages
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image'));

ALTER TABLE public.phone_chat_messages
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'image'));
