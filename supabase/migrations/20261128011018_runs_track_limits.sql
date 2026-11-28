-- Fausto 28.11.2026: track limits per lap, set by a moderator during the video check.
-- null = not checked (screenshot-only laps cannot be checked). Moderation only, not in public views.
alter table public.runs add column if not exists track_limits text;
alter table public.runs drop constraint if exists runs_track_limits_check;
alter table public.runs add constraint runs_track_limits_check check (track_limits is null or track_limits in ('respected', 'violated'));
comment on column public.runs.track_limits is 'Track limits on this lap, set by a moderator after a video check: respected / violated; null = not checked. Moderation only (Fausto 28.11.2026).';
