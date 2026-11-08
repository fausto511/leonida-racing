-- Driver Badge stage 2 (DEC-0230, RS-0121; Fausto 06.11.2026: "komplett ready, jederzeit einblendbar").
-- 1) site_flags: switches the website reads at runtime (no push needed).
--    Switch the badge on:  update public.site_flags set enabled = true  where key = 'driver_badge';
--    and off again:        update public.site_flags set enabled = false where key = 'driver_badge';
create table if not exists public.site_flags (
  key text primary key,
  enabled boolean not null default false,
  note text,
  updated_at timestamptz not null default now()
);
alter table public.site_flags enable row level security;
create policy site_flags_read on public.site_flags for select to anon, authenticated using (true);
grant select on public.site_flags to anon, authenticated;
insert into public.site_flags (key, enabled, note)
values ('driver_badge', false, 'Driver Badge (DEC-0230) on the website')
on conflict (key) do nothing;

-- 2) public_driver_badges: one row per driver with an accepted lap. Same rules as site/src/data/badge.ts:
--    n = cars + tracks with an accepted lap; colour per class (Gellhorn, PS5) with >= 4 drivers,
--    position 0 = first .. 1 = last, averaged; among ranked drivers ahead of >= 90 % pink, >= 65 % gold,
--    >= 30 % silver, else bronze; grey = no class with 4 drivers yet. Checked 08.11. against badge.ts (14/14).
create or replace view public.public_driver_badges with (security_invoker = true) as
with lb as (select driver_id, vehicle_id, track_id, platform, lap_time_ms from public.public_leaderboard),
cars as (select driver_id, count(distinct (vehicle_id, track_id)) as n from lb group by driver_id),
g as (
  select l.driver_id, c.cls, min(l.lap_time_ms) as best
  from lb l join public.vehicles v on v.vehicle_id = l.vehicle_id
  cross join lateral unnest(v.classes) as c(cls)
  where l.track_id = 'gellhorn-international-raceway' and l.platform = 'ps5'
  group by l.driver_id, c.cls),
gc as (select g.*, count(*) over (partition by cls) as cnt,
              row_number() over (partition by cls order by best, driver_id) - 1 as i from g),
pos as (select driver_id, avg(i::numeric / (cnt - 1)) as score from gc where cnt >= 4 group by driver_id),
rk as (select driver_id, row_number() over (order by score, driver_id) - 1 as i, count(*) over () as cnt from pos),
b as (select driver_id, case when cnt > 1 then (cnt - 1 - i)::numeric / (cnt - 1) else 1 end as better from rk)
select c.driver_id, c.n::int as n,
  case when b.better is null then 'grey' when b.better >= 0.90 then 'pink' when b.better >= 0.65 then 'gold'
       when b.better >= 0.30 then 'silver' else 'bronze' end as tier,
  round(b.better * 100)::int as ahead_pct
from cars c left join b using (driver_id);
grant select on public.public_driver_badges to anon, authenticated;
