-- First-seen evidence links (Fausto/Codex 2026-10-06): official Rockstar source for "First Seen In",
-- videos with timestamp. Only official Rockstar hosts allowed. Applied live 2026-10-06 via MCP.
alter table public.vehicles
  add column first_seen_url text,
  add column first_seen_timestamp text;
alter table public.vehicles
  add constraint vehicles_first_seen_url_official check (
    first_seen_url is null
    or first_seen_url ~ '^https://(www\.youtube\.com/watch\?v=[A-Za-z0-9_-]+(&t=[0-9]+s)?|www\.rockstargames\.com/)'
  ),
  add constraint vehicles_first_seen_timestamp_format check (
    first_seen_timestamp is null or first_seen_timestamp ~ '^[0-9]{1,2}:[0-5][0-9]$'
  );
comment on column public.vehicles.first_seen_url is 'Official Rockstar source for first_seen_in (YouTube with &t=, or rockstargames.com)';
comment on column public.vehicles.first_seen_timestamp is 'm:ss inside the video, null for screenshots';

-- Data (run separately via SQL, 2026-10-06): 17 verified sources from
-- Codex Zuarbeit/Fahrzeug-Sichtungsbelege-2026-10-06.csv; has_photo = true for
-- albany-manana, annis-elegy-retro-custom, declasse-tulip, ubermacht-cypher,
-- ubermacht-sentinel-classic-cabrio, vapid-caracara-4x4.
