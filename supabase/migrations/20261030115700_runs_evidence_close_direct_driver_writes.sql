-- Security fix before launch (30.10.2026, found while building RS-0091):
-- drivers could write lap rows directly through the public REST API, bypassing
-- submit-lap / moderate-submission. runs_insert_own only checked driver_id, so a
-- logged-in driver could insert a run already 'accepted' + 'provisional'/'official'
-- (public leaderboard) and attach their own public video evidence; and
-- runs_update_own_before_review let a driver change ANY column (review_status,
-- publication_status, lap_time_ms) of a run in draft/needs_correction.
-- All legitimate driver writes go through Edge Functions with the service role
-- (submit-lap, withdraw-run, add-video-evidence, and the correction flow of RS-0091),
-- so direct driver writes are not needed. Moderator updates (runs_update_moderator,
-- evidence_update_moderator) stay as they are.
drop policy if exists runs_insert_own on public.runs;
drop policy if exists runs_update_own_before_review on public.runs;
drop policy if exists evidence_insert_own_run on public.evidence;
revoke insert, delete, truncate, references, trigger on public.runs from authenticated, anon;
revoke insert, delete, truncate, references, trigger on public.evidence from authenticated, anon;
