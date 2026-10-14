-- Port Phase 0 (DEC-0118, DEC-0119; Handoff "Port Phase 0", 2026-10-14):
-- database groundwork for the redesign, no visible change on the website yet.
--
-- 1. vehicle_ratings + public_vehicle_ratings  (driver rating per car, 1-5 stars)
-- 2. public_vehicle_owner_counts                (how many drivers have the car in My Garage)
-- 3. public_leaderboard_ranks / _verified_ranks (rank overall / per class / per car,
--                                                gap to the driver ahead = "Next target",
--                                                rank 1 per class = "Fastest at Gellhorn")
-- 4. anonymize_driver_account() also deletes the driver's ratings.

-- ---------------------------------------------------------------------------
-- 1. Ratings
-- ---------------------------------------------------------------------------
-- Same launch moment as hub_events_not_before_launch: 19 Nov 2026 00:00 in the
-- earliest time zone (UTC+14) = 2026-11-18 10:00 UTC.
create or replace function public.ratings_open()
returns boolean language sql stable set search_path = public as $$
  select now() >= timestamptz '2026-11-18 10:00:00+00';
$$;

create table public.vehicle_ratings (
  driver_id  uuid not null references public.drivers(driver_id) on delete cascade,
  vehicle_id text not null references public.vehicles(vehicle_id) on delete cascade,
  stars      smallint not null check (stars between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (driver_id, vehicle_id)
);
create index vehicle_ratings_vehicle_idx on public.vehicle_ratings (vehicle_id);

create or replace function public.vehicle_ratings_touch()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger vehicle_ratings_touch before update on public.vehicle_ratings
  for each row execute function public.vehicle_ratings_touch();

alter table public.vehicle_ratings enable row level security;

-- Any signed-in driver may rate any officially shown car (no My Garage requirement),
-- one rating per driver and car, changeable at any time, writable from launch.
create policy vehicle_ratings_select_own on public.vehicle_ratings
  for select to authenticated using (driver_id = public.current_driver_id());
create policy vehicle_ratings_insert_own on public.vehicle_ratings
  for insert to authenticated with check (
    driver_id = public.current_driver_id() and public.ratings_open()
    and exists (select 1 from public.vehicles v where v.vehicle_id = vehicle_ratings.vehicle_id and v.release_id is not null));
create policy vehicle_ratings_update_own on public.vehicle_ratings
  for update to authenticated using (driver_id = public.current_driver_id())
  with check (driver_id = public.current_driver_id() and public.ratings_open());
create policy vehicle_ratings_delete_own on public.vehicle_ratings
  for delete to authenticated using (driver_id = public.current_driver_id());
create policy vehicle_ratings_moderator_read on public.vehicle_ratings
  for select to authenticated using (public.is_moderator());

grant select, insert, update, delete on public.vehicle_ratings to authenticated;

-- Public figures only from 3 ratings on; below that the car is not listed.
create view public.public_vehicle_ratings as
  select r.vehicle_id,
         round(avg(r.stars)::numeric, 1) as rating_avg,
         count(*)::int                   as rating_count
    from public.vehicle_ratings r
    join public.drivers d on d.driver_id = r.driver_id and d.deleted_at is null
   group by r.vehicle_id
  having count(*) >= 3;
grant select on public.public_vehicle_ratings to anon, authenticated;

-- Moderators remove a single rating; logged in moderation_log.
create or replace function public.moderator_remove_rating(p_driver uuid, p_vehicle text, p_reason text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_old public.vehicle_ratings;
begin
  if not public.is_moderator() then raise exception 'not allowed'; end if;
  delete from public.vehicle_ratings where driver_id = p_driver and vehicle_id = p_vehicle returning * into v_old;
  if v_old is null then return false; end if;
  insert into public.moderation_log (moderator_driver_id, action, previous_value, reason)
  values (public.current_driver_id(), 'rating_removed',
          jsonb_build_object('driver_id', v_old.driver_id, 'vehicle_id', v_old.vehicle_id, 'stars', v_old.stars, 'updated_at', v_old.updated_at),
          p_reason);
  return true;
end $$;
revoke all on function public.moderator_remove_rating(uuid, text, text) from public, anon;
grant execute on function public.moderator_remove_rating(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. My Garage counter per car ("N drivers have it in their garage", later "Most owned")
-- ---------------------------------------------------------------------------
-- Count only, never names. Deleted accounts have no owned_vehicles rows left anyway.
create view public.public_vehicle_owner_counts as
  select o.vehicle_id, count(*)::int as owner_count
    from public.owned_vehicles o
    join public.drivers d on d.driver_id = o.driver_id and d.deleted_at is null
   group by o.vehicle_id;
grant select on public.public_vehicle_owner_counts to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Leaderboard ranks (DEC-0119)
-- ---------------------------------------------------------------------------
-- Built on public_leaderboard (= best lap per driver + car + track, accepted laps only).
-- One row per driver and scope:
--   scope 'overall' (scope_key = ''):         driver's best lap in any car
--   scope 'class'   (scope_key = class name): best lap in a car of that class
--                   (a car with several classes counts in each)
--   scope 'vehicle' (scope_key = vehicle_id): best lap in that car
-- Ties: the earlier submission ranks higher.
-- gap_to_ahead_ms / ahead_driver = "Next target"; rank 1 per class = "Fastest at Gellhorn".
create view public.public_leaderboard_ranks as
with base as (
  select l.*, v.classes
    from public.public_leaderboard l
    join public.vehicles v on v.vehicle_id = l.vehicle_id
),
scoped as (
  (select distinct on (track_id, driver_id) 'overall'::text as scope, ''::text as scope_key, b.*
     from base b order by track_id, driver_id, lap_time_ms, submitted_at)
  union all
  (select distinct on (b.track_id, c.cls, b.driver_id) 'class', c.cls, b.*
     from base b cross join lateral unnest(b.classes) as c(cls)
    order by b.track_id, c.cls, b.driver_id, b.lap_time_ms, b.submitted_at)
  union all
  (select 'vehicle', b.vehicle_id, b.* from base b)
),
ranked as (
  select s.*,
         row_number() over w as rank,
         count(*) over (partition by track_id, scope, scope_key) as scope_size,
         lag(driver) over w as ahead_driver,
         lag(driver_id) over w as ahead_driver_id,
         lag(lap_time_ms) over w as ahead_lap_time_ms,
         first_value(lap_time_ms) over w as leader_lap_time_ms
    from scoped s
  window w as (partition by track_id, scope, scope_key order by lap_time_ms, submitted_at
               rows between unbounded preceding and current row)
)
select track_id, scope, scope_key, rank::int, scope_size::int,
       run_id, driver_id, driver, vehicle_id, make, model, manufacturer_logo_slug, classes,
       platform, lap_time_ms, verification_tier, video_verified, video_url, submitted_at,
       lap_time_ms - leader_lap_time_ms as gap_to_leader_ms,
       lap_time_ms - ahead_lap_time_ms  as gap_to_ahead_ms,
       ahead_driver, ahead_driver_id
  from ranked;
grant select on public.public_leaderboard_ranks to anon, authenticated;

-- Same for "Video verified only".
create view public.public_leaderboard_verified_ranks as
with base as (
  select l.*, v.classes
    from public.public_leaderboard_verified l
    join public.vehicles v on v.vehicle_id = l.vehicle_id
),
scoped as (
  (select distinct on (track_id, driver_id) 'overall'::text as scope, ''::text as scope_key, b.*
     from base b order by track_id, driver_id, lap_time_ms, submitted_at)
  union all
  (select distinct on (b.track_id, c.cls, b.driver_id) 'class', c.cls, b.*
     from base b cross join lateral unnest(b.classes) as c(cls)
    order by b.track_id, c.cls, b.driver_id, b.lap_time_ms, b.submitted_at)
  union all
  (select 'vehicle', b.vehicle_id, b.* from base b)
),
ranked as (
  select s.*,
         row_number() over w as rank,
         count(*) over (partition by track_id, scope, scope_key) as scope_size,
         lag(driver) over w as ahead_driver,
         lag(driver_id) over w as ahead_driver_id,
         lag(lap_time_ms) over w as ahead_lap_time_ms,
         first_value(lap_time_ms) over w as leader_lap_time_ms
    from scoped s
  window w as (partition by track_id, scope, scope_key order by lap_time_ms, submitted_at
               rows between unbounded preceding and current row)
)
select track_id, scope, scope_key, rank::int, scope_size::int,
       run_id, driver_id, driver, vehicle_id, make, model, manufacturer_logo_slug, classes,
       platform, lap_time_ms, verification_tier, video_verified, video_url, submitted_at,
       lap_time_ms - leader_lap_time_ms as gap_to_leader_ms,
       lap_time_ms - ahead_lap_time_ms  as gap_to_ahead_ms,
       ahead_driver, ahead_driver_id
  from ranked;
grant select on public.public_leaderboard_verified_ranks to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Account deletion also removes ratings (DEC-0079)
-- ---------------------------------------------------------------------------
create or replace function public.anonymize_driver_account(p_driver uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.drivers where driver_id = p_driver and deleted_at is null) then
    raise exception 'no active driver %', p_driver;
  end if;

  -- personal / social data
  delete from public.hub_event_rsvps     where driver_id = p_driver;
  delete from public.owned_vehicles      where driver_id = p_driver;
  delete from public.vehicle_ratings     where driver_id = p_driver;
  delete from public.run_reports         where reporter_driver_id = p_driver;
  delete from public.content_reports     where reporter_driver_id = p_driver;
  delete from public.hub_events          where created_by = p_driver;   -- carry his PSN name
  delete from public.community_tracks    where created_by = p_driver;   -- carry his name as creator
  delete from public.hub_role_requests   where driver_id = p_driver;
  delete from public.hub_roles           where driver_id = p_driver;
  delete from public.crew_memberships    where driver_id = p_driver;
  delete from public.crew_membership_history where driver_id = p_driver;
  delete from public.moderators          where driver_id = p_driver;

  -- Discord feeds he set up: crew / public feeds keep running for the server,
  -- without any link to him. His personal host feed: see discord_housekeeping().
  update public.discord_feeds
     set created_by_discord_id = null, created_by_driver_id = null
   where created_by_driver_id = p_driver
      or created_by_discord_id = (select discord_user_id from public.drivers where driver_id = p_driver);

  -- submissions nobody can review any more (no evidence left)
  delete from public.runs
   where driver_id = p_driver
     and review_status in ('draft', 'submitted', 'under_review', 'needs_correction');

  -- evidence of the remaining (reviewed) times
  update public.evidence e set storage_reference = null, retention_state = 'deleted', delete_after = now()
    from public.runs r
   where r.run_id = e.run_id and r.driver_id = p_driver and e.type = 'screenshot';
  delete from public.evidence e using public.runs r
   where r.run_id = e.run_id and r.driver_id = p_driver and e.type = 'video_link';

  -- the driver row: no name, no Discord, no login link
  update public.drivers
     set display_name = 'Deleted driver', discord_user_id = null, auth_user_id = null,
         deleted_at = now()
   where driver_id = p_driver;
  delete from public.driver_name_history where driver_id = p_driver;  -- incl. the row the rename just logged
end $function$;
