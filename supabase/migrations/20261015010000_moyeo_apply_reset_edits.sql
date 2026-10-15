-- One-time reset requested on 2026-10-15: give all existing users two edits.
-- Preserve every submission and choice. Do not re-run after users start editing.
-- Bump timestamps so the new API rejects editor revisions from before the reset.
with reset as (
  update public.moyeo_apply_submissions
  set edit_count = 0, updated_at = clock_timestamp()
  returning edit_count
)
select count(*) as reset_submissions,
       min(2 - edit_count) as min_remaining_edits,
       max(2 - edit_count) as max_remaining_edits
from reset;
