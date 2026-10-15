-- Requested on 2026-10-15: move retired 국가데이터처 choices to 국가데이터처(무차별).
-- Keep choice order, academic rank, and edit count. Rows that already include
-- the new option are skipped to avoid duplicate choices.
-- Bump timestamps so editors opened before the move reload before saving.
begin;

with moved as (
  update public.moyeo_apply_submissions
  set choices = array_replace(choices, 'national-data-agency', 'national-data-agency-any'),
      updated_at = clock_timestamp()
  where 'national-data-agency' = any(choices)
    and not ('national-data-agency-any' = any(choices))
  returning 1
)
select count(*) as moved_submissions from moved;

-- Separate statement: a sibling subquery would still see the pre-update snapshot.
select count(*) as remaining_old
from public.moyeo_apply_submissions where 'national-data-agency' = any(choices);

commit;
