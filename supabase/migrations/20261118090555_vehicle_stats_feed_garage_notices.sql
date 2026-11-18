-- RS-0130 (Fausto 16.-18.11.2026): new vehicle stats
--  1) Discord: when a car gets new stats (vehicle_values, i.e. price, top speed, lap, in-game stats --
--     never text changes), one bundled post to every 'vehicles' feed. Outbox kind 'values', one row
--     per car; every new value pushes the waiting batch back 15 minutes, so a burst of entries
--     becomes one post. The dispatcher also waits until the car page shows the new stats.
--  2) Avatar dot: area 'garage' counts cars in My garage or on the wishlist that got new stats
--     since the driver last opened My garage. A value counts once the website had time to
--     rebuild (3 h cycle + build -> 3 h 30 min), so the dot never points at a page without it.

-- 1) Discord
alter table public.discord_outbox drop constraint discord_outbox_kind_check;
alter table public.discord_outbox add constraint discord_outbox_kind_check
  check (kind in ('event', 'backfill', 'vehicle', 'record', 'record_sync', 'values'));
alter table public.discord_outbox drop constraint discord_outbox_vehicle_check;
alter table public.discord_outbox add constraint discord_outbox_vehicle_check
  check ((kind in ('vehicle', 'values')) = (vehicle_id is not null));

create or replace function public.discord_enqueue_values() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'current' then return null; end if;
  if tg_op = 'UPDATE' and old.status = 'current' then return null; end if;
  -- only officially shown cars have a public page
  if not exists (select 1 from public.vehicles where vehicle_id = new.vehicle_id and release_id is not null) then return null; end if;
  if not exists (select 1 from public.discord_outbox where kind = 'values' and vehicle_id = new.vehicle_id and processed_at is null) then
    insert into public.discord_outbox (kind, vehicle_id, not_before) values ('values', new.vehicle_id, now() + interval '15 minutes');
  end if;
  update public.discord_outbox set not_before = now() + interval '15 minutes'
   where kind = 'values' and processed_at is null and attempts = 0;
  return null;
end $$;
drop trigger if exists vehicle_values_discord on public.vehicle_values;
create trigger vehicle_values_discord after insert or update of status on public.vehicle_values
  for each row execute function public.discord_enqueue_values();

create or replace function public.discord_claim_values()
returns setof public.discord_outbox language sql security definer set search_path = public as $$
  update public.discord_outbox o set processed_at = now(), attempts = o.attempts + 1
   where o.id in (select id from public.discord_outbox
                   where processed_at is null and not_before <= now() and kind = 'values'
                   order by id limit 200 for update skip locked)
  returning o.*;
$$;
revoke all on function public.discord_enqueue_values() from public, anon, authenticated;
revoke all on function public.discord_claim_values() from public, anon, authenticated;

-- 2) Avatar dot for My garage + wishlist
alter table public.driver_notice_seen drop constraint driver_notice_seen_area_check;
alter table public.driver_notice_seen add constraint driver_notice_seen_area_check
  check (area in ('laps', 'crews', 'events', 'tracks', 'settings', 'garage'));

-- cars of a driver (owned or wished) with stats that went live after s and after the car was added
create or replace function public.garage_new_stats(p_driver uuid, p_since timestamptz)
returns setof text language sql stable security definer set search_path = public as $$
  select distinct g.vehicle_id
    from (select vehicle_id, created_at as added_at from public.owned_vehicles where driver_id = p_driver
          union all
          select vehicle_id, created_at from public.wishlist_vehicles where driver_id = p_driver) g
    join public.vehicle_values v on v.vehicle_id = g.vehicle_id and v.status = 'current'
   where v.created_at + interval '3 hours 30 minutes' > p_since
     and v.created_at + interval '3 hours 30 minutes' > g.added_at
     and v.created_at + interval '3 hours 30 minutes' <= now();
$$;
revoke all on function public.garage_new_stats(uuid, timestamptz) from public, anon, authenticated;

-- for the My garage page: which cards get the "New stats" tag (read before it marks the area seen)
create or replace function public.my_new_stats_vehicles()
returns text[] language plpgsql stable security definer set search_path = public as $$
declare me uuid := public.current_driver_id(); s timestamptz;
begin
  if me is null then return array[]::text[]; end if;
  select seen_at into s from public.driver_notice_seen where driver_id = me and area = 'garage';
  if s is null then return array[]::text[]; end if;
  return coalesce((select array_agg(x) from public.garage_new_stats(me, s) x), array[]::text[]);
end $$;
revoke all on function public.my_new_stats_vehicles() from public, anon;
grant execute on function public.my_new_stats_vehicles() to authenticated;

create or replace function public.mark_notices_seen(p_area text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := public.current_driver_id();
begin
  if me is null or p_area not in ('laps', 'crews', 'events', 'tracks', 'settings', 'garage') then return; end if;
  insert into public.driver_notice_seen (driver_id, area, seen_at) values (me, p_area, now())
    on conflict (driver_id, area) do update set seen_at = excluded.seen_at;
end $function$;

create or replace function public.my_notices()
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := public.current_driver_id();
  s_laps timestamptz; s_crews timestamptz; s_events timestamptz; s_tracks timestamptz; s_settings timestamptz; s_garage timestamptz;
  r jsonb;
begin
  if me is null then return null; end if;
  -- first call: start from now, so old decisions never show up as "new"
  insert into public.driver_notice_seen (driver_id, area)
    select me, a from unnest(array['laps', 'crews', 'events', 'tracks', 'settings', 'garage']) a
    on conflict do nothing;
  select max(seen_at) filter (where area = 'laps'), max(seen_at) filter (where area = 'crews'),
         max(seen_at) filter (where area = 'events'), max(seen_at) filter (where area = 'tracks'),
         max(seen_at) filter (where area = 'settings'), max(seen_at) filter (where area = 'garage')
    into s_laps, s_crews, s_events, s_tracks, s_settings, s_garage
    from public.driver_notice_seen where driver_id = me;

  r := jsonb_build_object(
    'laps', jsonb_build_object(
      'fix', (select count(*) from public.runs where driver_id = me and review_status = 'needs_correction'),
      'new', (select count(*) from public.runs where driver_id = me and status_changed_at > s_laps
                and review_status in ('accepted', 'rejected', 'invalidated'))),
    'crews', jsonb_build_object(
      'fix', (select count(*) from public.crew_memberships where driver_id = me and status = 'invited')
           + (select count(*) from public.crew_memberships m where m.status = 'pending' and m.driver_id <> me
                and exists (select 1 from public.hub_roles h where h.driver_id = me and h.crew_id = m.crew_id and h.role in ('crew_leader', 'crew_commissioner'))),
      'new', (select count(*) from public.crew_memberships where driver_id = me and status = 'active'
                and decided_at > s_crews and decided_by is distinct from me)
           + (select count(*) from public.hub_role_requests where driver_id = me and role in ('crew_leader', 'crew_commissioner')
                and status in ('approved', 'rejected') and decided_at > s_crews)),
    'events', jsonb_build_object(
      -- a series counts once, not once per round
      'fix', (select count(distinct coalesce(e.series_id, e.event_id)) from public.hub_events e where e.created_by = me
                and coalesce(e.ends_at, e.starts_at) > now()
                and (e.host_notice is not null or e.review_status in ('needs_changes', 'rejected'))),
      'new', (select count(distinct coalesce(e.series_id, e.event_id)) from public.hub_events e join public.hub_event_reviews v on v.event_id = e.event_id
                where e.created_by = me and e.review_status = 'approved' and v.reviewed_at > s_events
                  and v.reviewed_by is distinct from me)
           + (select count(*) from public.hub_role_requests where driver_id = me and role = 'event_host'
                and status in ('approved', 'rejected') and decided_at > s_events)),
    'tracks', jsonb_build_object(
      'fix', (select count(*) from public.community_tracks where created_by = me and not is_published and review_note is not null),
      'new', (select count(*) from public.community_tracks where created_by = me and is_published and published_at > s_tracks)),
    'settings', jsonb_build_object(
      'fix', 0,
      'new', (select count(*) from public.hub_role_requests where driver_id = me
                and role not in ('crew_leader', 'crew_commissioner', 'event_host')
                and status in ('approved', 'rejected') and decided_at > s_settings)),
    'garage', jsonb_build_object(
      'fix', 0,
      'new', (select count(*) from public.garage_new_stats(me, s_garage)))
  );
  return r;
end $function$;
