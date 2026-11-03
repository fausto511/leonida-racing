-- RS-0095 part 2 / DEC-0203: league seasons (championships). A season is a hub_event_series row
-- with kind 'league' and a fixed list of 2-15 rounds (normal hub_events rows with series_id).
-- Sign-up once for the whole season (hub_series_entries); the limit counts per season. Every entry
-- has a sign-up on each upcoming round, so calendar counts, Discord cards and reminders keep working.
-- Leaving / being removed drops the sign-ups of all upcoming rounds. Hosts (and the host crew's
-- leader/commissioners) can remove drivers to free a spot; that doesn't block a new sign-up
-- (kick / ban do). Rounds can be added, moved or dropped without review (max. 15). "Round n of m"
-- comes from the view event_series_rounds. The season ends after its last round.

-- 1) series rows for seasons: no rhythm
alter table public.hub_event_series
  alter column freq drop not null, alter column weekday drop not null,
  alter column anchor_date drop not null, alter column local_time drop not null;
alter table public.hub_event_series add constraint hub_event_series_rule check (
  kind = 'league' or (freq is not null and weekday is not null and anchor_date is not null and local_time is not null));
alter table public.hub_event_series add constraint hub_event_series_league_norule check (
  kind = 'recurring' or (freq is null and weekday is null and monthly_nth is null and anchor_date is null and local_time is null));

-- 2) season entries
create table public.hub_series_entries (
  series_id uuid not null references public.hub_event_series(series_id) on delete cascade,
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  status text not null default 'in' check (status in ('in', 'removed')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (series_id, driver_id)
);
create index hub_series_entries_driver on public.hub_series_entries(driver_id);
alter table public.hub_series_entries enable row level security;
create policy hub_series_entries_read on public.hub_series_entries for select to authenticated
  using (driver_id = public.current_driver_id() or public.is_moderator()
         or exists (select 1 from public.hub_event_series s where s.series_id = hub_series_entries.series_id
                      and s.created_by = public.current_driver_id()));
revoke all on public.hub_series_entries from anon;
revoke insert, update, delete, truncate, references, trigger on public.hub_series_entries from authenticated;
grant select on public.hub_series_entries to authenticated;

-- 3) "Round 3 of 10" (approved seasons; respects who may see the events)
create view public.event_series_rounds with (security_invoker = true) as
  select e.event_id, e.series_id,
         (row_number() over (partition by e.series_id order by e.starts_at, e.event_id))::integer as round_no,
         (count(*) over (partition by e.series_id))::integer as round_total
    from public.hub_events e
   where e.status <> 'cancelled'
     and e.series_id in (select v.series_id from public.public_event_series v where v.kind = 'league');
grant select on public.event_series_rounds to anon, authenticated;

-- 4) join / leave (shared by website and Discord)
create or replace function public.season_join_as(p_series uuid, p_driver uuid)
 returns text language plpgsql security definer set search_path to 'public' as $$
declare s public.hub_event_series; n integer;
begin
  if p_driver is null then return 'no_profile'; end if;
  perform pg_advisory_xact_lock(hashtextextended('season:' || p_series::text, 0));
  select * into s from public.hub_event_series where series_id = p_series and kind = 'league';
  if not found or s.review_status <> 'approved' then return 'not_found'; end if;
  if exists (select 1 from public.hub_series_entries where series_id = p_series and driver_id = p_driver and status = 'in') then
    return 'already';
  end if;
  if s.status <> 'active' or not exists (
       select 1 from public.hub_events e where e.series_id = p_series and e.status <> 'cancelled' and e.is_published
          and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()) then
    return 'past';
  end if;
  if s.registration <> 'open' then return 'closed'; end if;
  if s.members_only and not exists (select 1 from public.crew_memberships m
       where m.crew_id = s.host_crew_id and m.driver_id = p_driver and m.status = 'active') then
    return 'members_only';
  end if;
  if exists (select 1 from public.hub_event_bans b where b.host_driver_id = s.created_by and b.driver_id = p_driver)
     or exists (select 1 from public.hub_event_kicks k join public.hub_events e on e.event_id = k.event_id
                 where e.series_id = p_series and k.driver_id = p_driver) then
    return 'blocked';
  end if;
  select count(*) into n from public.hub_series_entries x join public.drivers d on d.driver_id = x.driver_id
   where x.series_id = p_series and x.status = 'in' and d.deleted_at is null;
  if s.max_participants is not null and n >= s.max_participants then return 'full'; end if;
  insert into public.hub_series_entries (series_id, driver_id) values (p_series, p_driver)
  on conflict (series_id, driver_id) do update set status = 'in', created_at = now(), removed_at = null;
  perform set_config('lr.season', 'on', true);
  insert into public.hub_event_rsvps (event_id, driver_id)
  select e.event_id, p_driver from public.hub_events e
   where e.series_id = p_series and e.status <> 'cancelled' and e.is_published
     and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
  on conflict do nothing;
  perform set_config('lr.season', '', true);
  return 'in';
end $$;

-- p_mode 'self' = the driver leaves (entry deleted), 'removed' = host / kick (entry kept as removed,
-- so the driver sees it in the account)
create or replace function public.season_leave_as(p_series uuid, p_driver uuid, p_mode text)
 returns text language plpgsql security definer set search_path to 'public' as $$
declare had boolean;
begin
  if p_driver is null then return 'not_in'; end if;
  perform pg_advisory_xact_lock(hashtextextended('season:' || p_series::text, 0));
  had := exists (select 1 from public.hub_series_entries where series_id = p_series and driver_id = p_driver and status = 'in');
  perform set_config('lr.season', 'on', true);
  delete from public.hub_event_rsvps r using public.hub_events e
   where r.event_id = e.event_id and e.series_id = p_series and r.driver_id = p_driver
     and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now();
  if p_mode = 'removed' then
    update public.hub_series_entries set status = 'removed', removed_at = now()
     where series_id = p_series and driver_id = p_driver and status = 'in';
  else
    delete from public.hub_series_entries where series_id = p_series and driver_id = p_driver;
  end if;
  perform set_config('lr.season', '', true);
  return case when had then 'out' else 'not_in' end;
end $$;

-- a sign-up of a round removed some other way (old website, crew left, ban, account deleted)
-- = leaving the season. Skipped when the round itself is being deleted.
create or replace function public.hub_event_rsvps_season_leave()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
declare sid uuid;
begin
  if coalesce(current_setting('lr.season', true), '') = 'on' then return old; end if;
  select e.series_id into sid from public.hub_events e
    join public.hub_event_series s on s.series_id = e.series_id and s.kind = 'league'
   where e.event_id = old.event_id;
  if sid is not null then perform public.season_leave_as(sid, old.driver_id, 'self'); end if;
  return old;
end $$;
create trigger hub_event_rsvps_season_leave after delete on public.hub_event_rsvps
  for each row execute function public.hub_event_rsvps_season_leave();

-- rounds of a season can't be signed up for one by one
create or replace function public.hub_event_rsvp_allowed(p_event uuid, p_driver uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_driver is not null and exists (
    select 1 from public.hub_events e
    where e.event_id = p_event and e.is_published and e.status = 'scheduled'
      and e.registration = 'open'
      and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
      and (e.max_participants is null
           or (select count(*) from public.hub_event_rsvps r where r.event_id = e.event_id) < e.max_participants)
      and (not e.members_only or exists (
            select 1 from public.crew_memberships m
            where m.crew_id = e.host_crew_id and m.driver_id = p_driver and m.status = 'active'))
      and not exists (select 1 from public.hub_event_kicks k where k.event_id = e.event_id and k.driver_id = p_driver)
      and not exists (select 1 from public.hub_event_bans b where b.host_driver_id = e.created_by and b.driver_id = p_driver)
      and not exists (select 1 from public.hub_event_series s where s.series_id = e.series_id and s.kind = 'league')
  );
$$;

create or replace function public.join_season(p_series uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  return jsonb_build_object('status', public.season_join_as(p_series, public.current_driver_id()));
end $$;
create or replace function public.leave_season(p_series uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  return jsonb_build_object('status', public.season_leave_as(p_series, public.current_driver_id(), 'self'));
end $$;

-- Discord "I'm in" / "Withdraw" on a round card = the whole season
create or replace function public.discord_rsvp(p_event uuid, p_discord_id text, p_going boolean)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_driver uuid;
  v_e record;
  v_status text;
  v_count int;
  v_league boolean;
begin
  select driver_id into v_driver from drivers where discord_user_id = p_discord_id and deleted_at is null;
  if v_driver is null then return jsonb_build_object('status', 'no_profile'); end if;

  perform pg_advisory_xact_lock(hashtextextended('rsvp:' || p_event::text, 0));
  select e.*, c.discord_url as crew_discord_url into v_e
    from hub_events e left join crews c on c.crew_id = e.host_crew_id
   where e.event_id = p_event;
  if not found or not v_e.is_published then return jsonb_build_object('status', 'not_found'); end if;
  v_league := exists (select 1 from hub_event_series s where s.series_id = v_e.series_id and s.kind = 'league');

  if v_league then
    if p_going then
      v_status := case when v_e.status = 'cancelled' then 'cancelled' else public.season_join_as(v_e.series_id, v_driver) end;
    else
      v_status := public.season_leave_as(v_e.series_id, v_driver, 'self');
    end if;
  elsif p_going then
    if exists (select 1 from hub_event_rsvps where event_id = p_event and driver_id = v_driver) then
      v_status := 'already';
    elsif public.hub_event_rsvp_allowed(p_event, v_driver) then
      insert into hub_event_rsvps (event_id, driver_id) values (p_event, v_driver);
      v_status := 'in';
    elsif v_e.status = 'cancelled' then v_status := 'cancelled';
    elsif coalesce(v_e.ends_at, v_e.starts_at + interval '3 hours') <= now() then v_status := 'past';
    elsif v_e.registration <> 'open' then v_status := 'closed';
    elsif v_e.members_only and not exists (select 1 from crew_memberships m
            where m.crew_id = v_e.host_crew_id and m.driver_id = v_driver and m.status = 'active') then v_status := 'members_only';
    elsif exists (select 1 from hub_event_kicks k where k.event_id = p_event and k.driver_id = v_driver)
       or exists (select 1 from hub_event_bans b where b.host_driver_id = v_e.created_by and b.driver_id = v_driver) then v_status := 'blocked';
    else v_status := 'full';
    end if;
  else
    delete from hub_event_rsvps where event_id = p_event and driver_id = v_driver;
    v_status := case when found then 'out' else 'not_in' end;
  end if;

  select count(*) into v_count from hub_event_rsvps where event_id = p_event;
  -- COPY STATUS: " (whole season)" is a Claude placeholder, Codex review pending.
  return jsonb_build_object(
    'status', v_status, 'going', v_count, 'max', v_e.max_participants,
    'title', v_e.title || case when v_league then ' (whole season)' else '' end, 'host_name', v_e.host_name,
    'discord_url', coalesce(v_e.discord_url, v_e.crew_discord_url), 'season', v_league);
end $$;

-- kick from a round of a season = out of the season and blocked for it (DEC-0144 + DEC-0203)
create or replace function public.kick_event_participant(p_event uuid, p_driver uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare sid uuid;
begin
  perform public.event_assert_host(p_event, p_driver);
  insert into public.hub_event_kicks (event_id, driver_id, kicked_by)
  values (p_event, p_driver, public.current_driver_id()) on conflict do nothing;
  select e.series_id into sid from public.hub_events e
    join public.hub_event_series s on s.series_id = e.series_id and s.kind = 'league'
   where e.event_id = p_event;
  if sid is not null then
    perform public.season_leave_as(sid, p_driver, 'removed');
  else
    delete from public.hub_event_rsvps where event_id = p_event and driver_id = p_driver;
  end if;
end $$;

-- 5) host: participants, free a spot
create or replace function public.season_staff(p_series uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_moderator() or exists (
    select 1 from public.hub_event_series s where s.series_id = p_series and s.kind = 'league'
       and (s.created_by = public.current_driver_id()
            or (s.host_crew_id is not null and public.is_crew_staff_of(s.host_crew_id, public.current_driver_id()))));
$$;

create or replace function public.season_entries(p_series uuid)
 returns table(driver_id uuid, display_name text, status text, created_at timestamptz, removed_at timestamptz)
 language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.season_staff(p_series) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
    select x.driver_id, case when d.deleted_at is null then d.display_name end, x.status, x.created_at, x.removed_at
      from public.hub_series_entries x join public.drivers d on d.driver_id = x.driver_id
     where x.series_id = p_series and (x.status = 'in' or x.removed_at > now() - interval '30 days')
     order by x.status, x.created_at;
end $$;

create or replace function public.remove_season_entry(p_series uuid, p_driver uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.season_staff(p_series) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object('status', public.season_leave_as(p_series, p_driver, 'removed'));
end $$;

-- driver: own seasons (also "removed by the host" for 30 days)
create or replace function public.my_seasons()
 returns table(series_id uuid, title text, series_status text, entry_status text, removed_at timestamptz,
               next_event_id uuid, next_starts_at timestamptz, rounds_total integer, rounds_done integer)
 language sql stable security definer set search_path to 'public' as $$
  select s.series_id, s.title, s.status, x.status, x.removed_at,
         (select e.event_id from public.hub_events e where e.series_id = s.series_id and e.status <> 'cancelled'
             and coalesce(e.ends_at, e.starts_at + interval '2 hours') >= now() order by e.starts_at limit 1),
         (select min(e.starts_at) from public.hub_events e where e.series_id = s.series_id and e.status <> 'cancelled'
             and coalesce(e.ends_at, e.starts_at + interval '2 hours') >= now()),
         (select count(*) from public.hub_events e where e.series_id = s.series_id and e.status <> 'cancelled')::integer,
         (select count(*) from public.hub_events e where e.series_id = s.series_id and e.status <> 'cancelled'
             and coalesce(e.ends_at, e.starts_at + interval '2 hours') < now())::integer
    from public.hub_series_entries x join public.hub_event_series s on s.series_id = x.series_id
   where x.driver_id = public.current_driver_id() and s.kind = 'league'
     and (x.status = 'in' or x.removed_at > now() - interval '30 days')
   order by 7 nulls last;
$$;

-- 6) rounds
create or replace function public.season_parse_rounds(p jsonb)
 returns timestamptz[] language plpgsql stable as $$
declare a timestamptz[];
begin
  if p is null or jsonb_typeof(p) <> 'array' then
    raise exception 'rounds_required: add the dates of the rounds' using errcode = 'P0001';
  end if;
  select array_agg(t order by t) into a from (select distinct (x)::timestamptz t from jsonb_array_elements_text(p) x) q;
  return coalesce(a, '{}');
end $$;

-- new rounds from the season template; drivers already in the season get a sign-up
create or replace function public.season_add_rounds(p_series uuid, p_rounds timestamptz[])
 returns integer language plpgsql security definer set search_path to 'public' as $$
declare s public.hub_event_series; st timestamptz; n integer := 0; eid uuid;
begin
  select * into s from public.hub_event_series where series_id = p_series;
  perform set_config('lr.event_review', 'on', true);
  perform set_config('lr.event_sync', 'on', true);
  perform set_config('lr.season', 'on', true);
  foreach st in array coalesce(p_rounds, '{}') loop
    insert into public.hub_events (title, event_type, starts_at, ends_at, platforms, host_name, host_crew_id, location, description,
      discord_url, max_participants, registration, members_only, created_by, review_status, is_published, series_id)
    values (s.title, s.event_type, st, case when s.duration_min is not null then st + make_interval(mins => s.duration_min) end,
      s.platforms, s.host_name, s.host_crew_id, s.location, s.description, s.discord_url, s.max_participants, s.registration,
      s.members_only, s.created_by, case when s.review_status = 'approved' then 'approved' else 'pending' end,
      s.review_status = 'approved', s.series_id)
    returning event_id into eid;
    n := n + 1;
    if s.review_status = 'approved' then
      insert into public.hub_event_rsvps (event_id, driver_id)
      select eid, x.driver_id from public.hub_series_entries x join public.drivers d on d.driver_id = x.driver_id
       where x.series_id = p_series and x.status = 'in' and d.deleted_at is null
      on conflict do nothing;
    end if;
  end loop;
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
  perform set_config('lr.season', '', true);
  return n;
end $$;

create or replace function public.create_league_season(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := public.current_driver_id(); h public.event_hosts; s public.hub_event_series; n integer; lim integer;
  rounds timestamptz[]; is_mod boolean := public.is_moderator();
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  h := public.event_host_row(me);
  perform pg_advisory_xact_lock(hashtext('event_host:' || me::text));
  if h.blocked and not is_mod then
    raise exception 'host_blocked: you can''t submit events right now' using errcode = 'P0001';
  end if;
  s.series_id := gen_random_uuid(); s.kind := 'league'; s.created_by := me; s.status := 'active'; s.event_type := 'league';
  s.platforms := '{ps5}'; s.registration := 'open'; s.members_only := false; s.tz := 'UTC'; s.empty_count := 0;
  s.changes_requested := false; s.created_at := now(); s.updated_at := now(); s.submitted_at := now();
  s := public.series_from_json(s, p - array['freq','weekday','monthly_nth','anchor_date','local_time','rounds']);
  perform public.series_check(s);
  rounds := public.season_parse_rounds(p -> 'rounds');
  if coalesce(array_length(rounds, 1), 0) not between 2 and 15 then
    raise exception 'rounds_count: a season has 2 to 15 rounds' using errcode = 'P0001';
  end if;
  if rounds[1] <= now() then raise exception 'round_past: all rounds have to be in the future' using errcode = 'P0001'; end if;
  select count(*) into n from public.hub_event_series where created_by = me and kind = 'league' and status = 'active'
     and review_status not in ('rejected','expired');
  if n >= 3 and not is_mod then
    raise exception 'season_limit: you can run up to 3 seasons at a time' using errcode = 'P0001';
  end if;
  if is_mod then
    s.review_status := 'approved';
  elsif h.level = 3 then
    if public.event_host_day_count(me) >= h.daily_limit then
      raise exception 'daily_limit: you can create % events per 24 hours', h.daily_limit using errcode = 'P0001';
    end if;
    s.review_status := 'approved';
  else
    if rounds[1] < now() + interval '24 hours' then
      raise exception 'lead_time: the event has to start at least 24 hours from now' using errcode = 'P0001';
    end if;
    lim := 3; if h.level = 1 then lim := 1; end if;
    if public.event_host_open_count(me) >= lim then
      raise exception 'open_limit: you can have % event(s) in review at a time', lim using errcode = 'P0001';
    end if;
    s.review_status := 'pending';
  end if;
  insert into public.hub_event_series select s.*;
  perform public.season_add_rounds(s.series_id, rounds);
  if s.review_status = 'pending' then
    insert into public.discord_mod_alerts (kind, actor, detail, link)
    select 'Season submitted (stage ' || h.level || ')', d.display_name, left(s.title, 80), 'moderator/hub/'
      from public.drivers d where d.driver_id = me;
  end if;
  return jsonb_build_object('status', 'ok', 'series_id', s.series_id, 'review_status', s.review_status,
    'rounds', array_length(rounds, 1));
end $$;

-- p_rounds: all upcoming rounds as the host wants them, [{event_id?, starts_at}]. Rounds left out are
-- dropped (cancelled if drivers are in, else deleted); past rounds stay. Stage 1/2: rounds in the
-- next 24 hours can't be added, moved or dropped.
create or replace function public.set_season_rounds(p_series uuid, p_rounds jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := public.current_driver_id(); is_mod boolean := public.is_moderator(); o public.hub_event_series;
  h public.event_hosts; lock_until timestamptz; past_n integer; total integer; it jsonb; eid uuid; st timestamptz;
  ev public.hub_events; keep uuid[] := '{}'; newr timestamptz[] := '{}';
begin
  select * into o from public.hub_event_series where series_id = p_series for update;
  if not found or o.kind <> 'league' or (o.created_by is distinct from me and not is_mod) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if o.status <> 'active' or o.review_status in ('rejected','expired') then
    raise exception 'not_editable: this series can''t be changed any more' using errcode = 'P0001';
  end if;
  if p_rounds is null or jsonb_typeof(p_rounds) <> 'array' then
    raise exception 'rounds_required: add the dates of the rounds' using errcode = 'P0001';
  end if;
  h := public.event_host_row(o.created_by);
  lock_until := now() + case when not is_mod and (h.level < 3 or h.blocked) then interval '24 hours' else interval '0' end;
  select count(*) into past_n from public.hub_events
   where series_id = p_series and status <> 'cancelled' and starts_at <= now();
  total := past_n + jsonb_array_length(p_rounds);
  if total < 2 or total > 15 then
    raise exception 'rounds_count: a season has 2 to 15 rounds' using errcode = 'P0001';
  end if;
  perform set_config('lr.event_review', 'on', true);
  perform set_config('lr.event_sync', 'on', true);
  for it in select x from jsonb_array_elements(p_rounds) x loop
    st := (it ->> 'starts_at')::timestamptz;
    if st is null or st <= now() then raise exception 'round_past: all rounds have to be in the future' using errcode = 'P0001'; end if;
    eid := nullif(it ->> 'event_id', '')::uuid;
    if eid is not null then
      select * into ev from public.hub_events where event_id = eid and series_id = p_series and starts_at > now() and status <> 'cancelled';
      if not found then raise exception 'round_unknown' using errcode = 'P0001'; end if;
      if ev.starts_at is distinct from st then
        if ev.starts_at < lock_until or st < lock_until then
          raise exception 'time_locked: the time can only change while the event is at least 24 hours away' using errcode = 'P0001';
        end if;
        update public.hub_events
           set starts_at = st,
               ends_at = case when ends_at is not null then st + (ends_at - starts_at) end,
               series_override = true
         where event_id = eid;
      end if;
      keep := keep || eid;
    else
      if st < lock_until then
        raise exception 'lead_time: the event has to start at least 24 hours from now' using errcode = 'P0001';
      end if;
      newr := newr || st;
    end if;
  end loop;
  for ev in select * from public.hub_events where series_id = p_series and starts_at > now() and status <> 'cancelled'
             and not (event_id = any (keep)) loop
    if ev.starts_at < lock_until then
      raise exception 'time_locked: rounds in the next 24 hours can''t be removed' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.hub_event_rsvps v where v.event_id = ev.event_id) then
      update public.hub_events set status = 'cancelled' where event_id = ev.event_id;
    else
      delete from public.hub_events where event_id = ev.event_id;
    end if;
  end loop;
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
  if array_length(newr, 1) > 0 then perform public.season_add_rounds(p_series, newr); end if;
  update public.hub_event_series set updated_at = now() where series_id = p_series;
  return jsonb_build_object('status', 'ok', 'rounds', total);
end $$;

-- 7) existing functions: recurring-only parts, seasons in the host status
create or replace function public.series_fill(p_series uuid)
 returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  s public.hub_event_series; n integer; d date; st timestamptz; from_d date; added integer := 0;
  earliest timestamptz;
begin
  select * into s from public.hub_event_series where series_id = p_series for update;
  if not found or s.kind <> 'recurring' or s.status <> 'active' or s.review_status in ('rejected', 'expired') then return 0; end if;
  select count(*) into n from public.hub_events where series_id = s.series_id and starts_at > now();
  if n >= 4 then return 0; end if;
  earliest := greatest(now() + case when s.review_status = 'approved' then interval '0' else interval '24 hours' end,
                       '2026-11-18 10:00+00'::timestamptz);
  from_d := greatest(s.anchor_date, (now() at time zone s.tz)::date);  -- existing dates are skipped (unique series_id + date)
  perform set_config('lr.event_review', 'on', true);
  perform set_config('lr.event_sync', 'on', true);
  for d in select x from public.series_dates(s.freq, s.anchor_date, s.monthly_nth, s.weekday, from_d, 12) x loop
    exit when n >= 4;
    st := (d + s.local_time) at time zone s.tz;
    continue when st < earliest;
    insert into public.hub_events (title, event_type, starts_at, ends_at, platforms, host_name, host_crew_id, location, description,
      discord_url, max_participants, registration, members_only, created_by, review_status, is_published, series_id, occurs_on)
    values (s.title, s.event_type, st, case when s.duration_min is not null then st + make_interval(mins => s.duration_min) end,
      s.platforms, s.host_name, s.host_crew_id, s.location, s.description, s.discord_url, s.max_participants, s.registration,
      s.members_only, s.created_by, case when s.review_status = 'approved' then 'approved' else 'pending' end,
      s.review_status = 'approved', s.series_id, d)
    on conflict (series_id, occurs_on) where series_id is not null do nothing;
    if found then n := n + 1; added := added + 1; end if;
  end loop;
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
  return added;
end $$;

create or replace function public.update_event_series(p_series uuid, p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := public.current_driver_id(); h public.event_hosts; o public.hub_event_series; s public.hub_event_series;
  pend jsonb; f text; reviewed boolean; rule_changed boolean; lock_until timestamptz;
begin
  select * into o from public.hub_event_series where series_id = p_series for update;
  if not found or (o.created_by is distinct from me and not public.is_moderator()) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if o.status <> 'active' or o.review_status in ('rejected','expired') then
    raise exception 'not_editable: this series can''t be changed any more' using errcode = 'P0001';
  end if;
  if o.kind = 'league' then p := p - array['freq','weekday','monthly_nth','anchor_date','local_time','rounds']; end if;
  h := public.event_host_row(o.created_by);
  s := public.series_from_json(o, p);
  perform public.series_check(s);
  reviewed := not public.is_moderator() and o.review_status = 'approved' and (h.level < 3 or h.blocked);
  if reviewed then
    pend := coalesce(o.pending, '{}'::jsonb);
    foreach f in array array['title','description','discord_url'] loop
      if (to_jsonb(s) -> f) is distinct from (to_jsonb(o) -> f) then pend := pend || jsonb_build_object(f, to_jsonb(s) -> f); end if;
    end loop;
    s.title := o.title; s.description := o.description; s.discord_url := o.discord_url;
    if pend = '{}'::jsonb then pend := null; end if;
    s.pending := pend;
    if pend is distinct from o.pending then
      s.pending_since := case when pend is not null then now() end; s.edit_note := null;
      if pend is not null then
        insert into public.discord_mod_alerts (kind, actor, detail, link)
        select 'Series changes submitted', d.display_name, left(o.title, 80), 'moderator/hub/' from public.drivers d where d.driver_id = o.created_by;
      end if;
    end if;
  end if;
  if o.review_status = 'needs_changes' and not public.is_moderator() then
    s.review_status := 'pending'; s.submitted_at := now();
    insert into public.discord_mod_alerts (kind, actor, detail, link)
    select 'Series resubmitted', d.display_name, left(s.title, 80), 'moderator/hub/' from public.drivers d where d.driver_id = o.created_by;
  end if;
  rule_changed := o.kind = 'recurring' and (s.freq, s.weekday, s.monthly_nth, s.anchor_date, s.local_time, s.tz, s.duration_min)
       is distinct from (o.freq, o.weekday, o.monthly_nth, o.anchor_date, o.local_time, o.tz, o.duration_min);
  s.updated_at := now();
  update public.hub_event_series set
    title = s.title, description = s.description, event_type = s.event_type, platforms = s.platforms, host_name = s.host_name,
    host_crew_id = s.host_crew_id, location = s.location, discord_url = s.discord_url, max_participants = s.max_participants,
    registration = s.registration, members_only = s.members_only, freq = s.freq, weekday = s.weekday, monthly_nth = s.monthly_nth,
    anchor_date = s.anchor_date, local_time = s.local_time, tz = s.tz, duration_min = s.duration_min,
    review_status = s.review_status, submitted_at = s.submitted_at, pending = s.pending, pending_since = s.pending_since,
    edit_note = s.edit_note, updated_at = s.updated_at
   where series_id = p_series;
  perform public.series_push(p_series);
  if s.registration is distinct from o.registration
     or (o.kind = 'league' and s.duration_min is distinct from o.duration_min) then
    perform set_config('lr.event_review', 'on', true);
    perform set_config('lr.event_sync', 'on', true);
    update public.hub_events
       set registration = s.registration,
           ends_at = case when o.kind = 'league' and s.duration_min is distinct from o.duration_min
                          then case when s.duration_min is not null then starts_at + make_interval(mins => s.duration_min) end
                          else ends_at end
     where series_id = p_series and starts_at > now();
    perform set_config('lr.event_review', '', true);
    perform set_config('lr.event_sync', '', true);
  end if;
  if rule_changed then
    -- dates without sign-ups are laid out again; dates with sign-ups and those in the next 24 h (stage 1/2) stay
    lock_until := now() + case when h.level < 3 or h.blocked then interval '24 hours' else interval '0' end;
    perform set_config('lr.event_review', 'on', true);
    perform set_config('lr.event_sync', 'on', true);
    delete from public.hub_events e where e.series_id = p_series and e.starts_at > lock_until and not e.series_override
       and not exists (select 1 from public.hub_event_rsvps v where v.event_id = e.event_id);
    perform set_config('lr.event_review', '', true);
    perform set_config('lr.event_sync', '', true);
  end if;
  perform public.series_fill(p_series);
  return jsonb_build_object('status', 'ok', 'review_status', s.review_status, 'pending', s.pending);
end $$;

create or replace function public.my_event_host_status()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare me uuid := public.current_driver_id(); h public.event_hosts; lvl integer; open_n integer; day_n integer; ser_n integer; lea_n integer;
begin
  if me is null then return null; end if;
  select * into h from public.event_hosts where driver_id = me;
  lvl := coalesce(h.level, case when exists (select 1 from public.hub_roles where driver_id = me and role = 'event_host') then 2 else 1 end);
  open_n := public.event_host_open_count(me);
  day_n := public.event_host_day_count(me);
  select count(*) filter (where kind = 'recurring'), count(*) filter (where kind = 'league') into ser_n, lea_n
    from public.hub_event_series where created_by = me and status = 'active' and review_status not in ('rejected','expired');
  return jsonb_build_object('level', lvl, 'blocked', coalesce(h.blocked, false),
    'open', open_n, 'open_limit', case when lvl = 3 then null when lvl = 1 then 1 else 3 end,
    'daily_limit', case when lvl = 3 then coalesce(h.daily_limit, 3) end, 'created_24h', day_n,
    'lead_hours', case when lvl = 3 then 0 else 24 end, 'series', ser_n, 'series_limit', 3, 'seasons', lea_n, 'season_limit', 3);
end $$;

-- 8) hourly job: seasons end after the last round; note 48 h before round 1 without entries
create or replace function public.series_housekeeping()
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; nx uuid; added integer := 0; alerts integer := 0; ended integer := 0;
begin
  perform set_config('lr.event_review', 'on', true);
  perform set_config('lr.event_sync', 'on', true);
  for r in
    select e.event_id, e.series_id, exists (select 1 from public.hub_event_rsvps v where v.event_id = e.event_id) as anyone
      from public.hub_events e join public.hub_event_series s on s.series_id = e.series_id
     where not e.series_counted and e.status <> 'cancelled' and e.review_status = 'approved'
       and coalesce(e.ends_at, e.starts_at + interval '2 hours') < now() and s.kind = 'recurring'
     order by e.starts_at
  loop
    update public.hub_events set series_counted = true where event_id = r.event_id;
    if r.anyone then
      update public.hub_event_series set empty_count = 0, warned_at = null, mod_alert_at = null where series_id = r.series_id;
    else
      update public.hub_event_series set empty_count = empty_count + 1 where series_id = r.series_id;
    end if;
  end loop;
  update public.hub_events set series_counted = true
   where series_id is not null and not series_counted and (status = 'cancelled' or review_status <> 'approved') and starts_at < now();
  update public.hub_event_series set warned_at = now() where kind = 'recurring' and status = 'active' and empty_count >= 2 and warned_at is null;
  for r in select s.series_id, s.title, d.display_name from public.hub_event_series s left join public.drivers d on d.driver_id = s.created_by
            where s.kind = 'recurring' and s.status = 'active' and s.empty_count >= 3 and s.mod_alert_at is null loop
    insert into public.discord_mod_alerts (kind, actor, detail, link)
    values ('Series: 3 dates without sign-ups', r.display_name, left(r.title, 80), 'moderator/hub/');
    update public.hub_event_series set mod_alert_at = now() where series_id = r.series_id;
    alerts := alerts + 1;
  end loop;
  -- seasons
  update public.hub_event_series s
     set status = 'ended', ended_at = now(), updated_at = now(),
         review_status = case when s.review_status in ('pending','needs_changes') then 'expired' else s.review_status end
   where s.kind = 'league' and s.status = 'active'
     and not exists (select 1 from public.hub_events e where e.series_id = s.series_id and e.status <> 'cancelled'
                       and coalesce(e.ends_at, e.starts_at + interval '2 hours') >= now());
  get diagnostics ended = row_count;
  update public.hub_event_series s set warned_at = now()
   where s.kind = 'league' and s.status = 'active' and s.review_status = 'approved' and s.warned_at is null
     and not exists (select 1 from public.hub_series_entries x where x.series_id = s.series_id and x.status = 'in')
     and (select min(e.starts_at) from public.hub_events e where e.series_id = s.series_id and e.status <> 'cancelled')
         between now() and now() + interval '48 hours';
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
  for r in select series_id from public.hub_event_series where kind = 'recurring' and status = 'active' and review_status not in ('rejected','expired') loop
    added := added + public.series_fill(r.series_id);
  end loop;
  for r in select series_id, next_event_id from public.hub_event_series where status = 'active' or next_event_id is not null loop
    select e.event_id into nx from public.hub_events e
     where e.series_id = r.series_id and e.status <> 'cancelled' and e.is_published
       and coalesce(e.ends_at, e.starts_at + interval '2 hours') >= now()
     order by e.starts_at limit 1;
    if nx is distinct from r.next_event_id then
      insert into public.discord_outbox (kind, event_id)
      select 'event', x from unnest(array[r.next_event_id, nx]) x
       where x is not null and not exists (select 1 from public.discord_outbox o where o.kind = 'event' and o.event_id = x and o.processed_at is null);
      update public.hub_event_series set next_event_id = nx where series_id = r.series_id;
    end if;
  end loop;
  return jsonb_build_object('dates_added', added, 'mod_alerts', alerts, 'seasons_ended', ended);
end $$;

-- 9) grants
revoke all on function public.season_join_as(uuid, uuid), public.season_leave_as(uuid, uuid, text),
  public.hub_event_rsvps_season_leave(), public.season_parse_rounds(jsonb), public.season_add_rounds(uuid, timestamptz[]),
  public.season_staff(uuid) from public, anon, authenticated;
revoke all on function public.join_season(uuid), public.leave_season(uuid), public.season_entries(uuid),
  public.remove_season_entry(uuid, uuid), public.my_seasons(), public.create_league_season(jsonb),
  public.set_season_rounds(uuid, jsonb) from public, anon;
grant execute on function public.join_season(uuid), public.leave_season(uuid), public.season_entries(uuid),
  public.remove_season_entry(uuid, uuid), public.my_seasons(), public.create_league_season(jsonb),
  public.set_season_rounds(uuid, jsonb) to authenticated;
