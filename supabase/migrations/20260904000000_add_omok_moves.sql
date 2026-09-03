-- ========================================================
-- 오목: 대국 수순(기보) 데이터 DB 기록용 컬럼 추가
-- ========================================================

-- 1. 진행 중인 방의 수순 누적용 (대국 종료 시까지 보관)
ALTER TABLE public.omok_rooms
    ADD COLUMN IF NOT EXISTS moves JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. 대국 전적에 영구 보관되는 기보 (분석/통계/복기 활용용)
ALTER TABLE public.omok_matches
    ADD COLUMN IF NOT EXISTS moves JSONB NOT NULL DEFAULT '[]'::jsonb;
