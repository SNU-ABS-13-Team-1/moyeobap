ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_category_check;

ALTER TABLE public.restaurants
    ADD CONSTRAINT restaurants_category_check CHECK (category IN ('lunch', 'cafe', 'other'));
