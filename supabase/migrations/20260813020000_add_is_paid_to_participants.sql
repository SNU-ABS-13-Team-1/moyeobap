-- ========================================================
-- pot_participants 테이블에 is_paid 칼럼 추가
-- ========================================================

ALTER TABLE public.pot_participants 
ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE;
