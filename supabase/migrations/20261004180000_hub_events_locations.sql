-- Event locations as a fixed list (Fausto 2026-10-04, DEC-0101).
-- Seed = the six regions Rockstar has officially named for GTA VI, plus one
-- entry for events spanning several regions. More places (districts, tracks)
-- are added after release with a plain INSERT -- no code change needed.
-- Stored as the display name (FK, ON UPDATE CASCADE), so a later rename
-- follows into hub_events automatically and the calendar can filter on it.
create table if not exists public.hub_locations (
  name       text primary key check (char_length(name) between 2 and 80),
  sort_order int  not null default 100,
  created_at timestamptz not null default now()
);
alter table public.hub_locations enable row level security;
drop policy if exists hub_locations_read on public.hub_locations;
create policy hub_locations_read on public.hub_locations for select to anon, authenticated using (true);
grant select on public.hub_locations to anon, authenticated;

insert into public.hub_locations (name, sort_order) values
  ('Vice City', 10),
  ('Leonida Keys', 20),
  ('Grassrivers', 30),
  ('Port Gellhorn', 40),
  ('Ambrosia', 50),
  ('Mount Kalaga National Park', 60),
  ('Several regions', 90)
on conflict (name) do nothing;

alter table public.hub_events drop constraint if exists hub_events_location_fkey;
alter table public.hub_events add constraint hub_events_location_fkey
  foreign key (location) references public.hub_locations(name) on update cascade;

-- "Details link" retired (DEC-0101): we don't publish arbitrary links. Hosts point
-- to rules/info via their Discord invite (created on their rules channel).
-- (prod 2026-10-04: applied without this drop -- the old https check stays, redundant.)
alter table public.hub_events drop constraint if exists hub_events_join_url_check;
alter table public.hub_events drop constraint if exists hub_events_join_url_retired;
alter table public.hub_events add constraint hub_events_join_url_retired check (join_url is null);
