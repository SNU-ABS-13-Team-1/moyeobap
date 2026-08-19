-- ========================================================
-- pot_participants 테이블에 order_memo 칼럼 추가
-- ========================================================

ALTER TABLE public.pot_participants 
ADD COLUMN IF NOT EXISTS order_memo TEXT;
