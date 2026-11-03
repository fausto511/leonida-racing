-- RS-0095 / DEC-0203 (+ Nachtrag 03.11.): recurring event series (weekly, every 2 weeks, monthly
-- 1st-4th / last weekday). The series is its own row; every date is a normal hub_events row with
-- series_id (sign-ups, calendar, bot, kicks keep working). Always 4 upcoming dates; an hourly job
-- adds new ones, counts dates without sign-ups (2 -> note in the host's account, 3 -> mod alert),
-- and tells the bot when a series' next date changes (feed shows only the next date).
-- Review: the series goes through the host stages (DEC-0209) like one event and counts as 1.

-- 1) series
create table public.hub_event_series (
  series_id uuid primary key default gen_random_uuid(),
  kind text not null default 'recurring' check (kind in ('recurring', 'league')),
  created_by uuid references public.drivers(driver_id) on delete set null,
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  review_status text not null default 'pending' check (review_status in ('pending','needs_changes','rejected','expired','approved')),
  -- template for every date
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text check (description is null or char_length(description) <= 600),
  event_type text not null check (event_type in ('race','time-attack','league','car-meet','cruise','other')),
  platforms text[] not null default '{ps5}' check (platforms <@ array['ps5','xbox']),
  host_name text check (host_name is null or host_name ~ '^[A-Za-z][A-Za-z0-9_-]{2,15}$'),
  host_crew_id uuid references public.crews(crew_id) on delete set null,
  location text references public.hub_locations(name) on update cascade,
  discord_url text check (discord_url is null or discord_url ~ '^https://(discord\.gg|discord\.com/invite)/[A-Za-z0-9-]+$'),
  max_participants integer check (max_participants is null or max_participants between 2 and 500),
  registration text not null default 'open' check (registration in ('open','closed')),
  members_only boolean not null default false check (not members_only or host_crew_id is not null),
  -- rhythm: local time in the host's time zone (20:00 stays 20:00 across DST)
  freq text not null check (freq in ('weekly','biweekly','monthly')),
  weekday smallint not null check (weekday between 1 and 7),          -- ISO: 1 = Monday
  monthly_nth smallint check (monthly_nth in (1,2,3,4,-1)),            -- -1 = last
  anchor_date date not null,
  local_time time not null,
  tz text not null default 'UTC',
  duration_min integer check (duration_min is null or duration_min between 15 and 1440),
  check ((freq = 'monthly') = (monthly_nth is not null)),
  -- review (private: table is readable only by the host and moderators)
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.drivers(driver_id) on delete set null,
  note text check (note is null or char_length(note) <= 300),
  changes_requested boolean not null default false,
  pending jsonb,
  pending_since timestamptz,
  edit_note text check (edit_note is null or char_length(edit_note) <= 300),
  -- dates without sign-ups
  empty_count integer not null default 0,
  warned_at timestamptz,
  mod_alert_at timestamptz,
  next_event_id uuid,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hub_event_series_host on public.hub_event_series(created_by);
alter table public.hub_event_series enable row level security;
create policy hub_event_series_read on public.hub_event_series for select to authenticated
  using (created_by = public.current_driver_id() or public.is_moderator());
revoke all on public.hub_event_series from anon;
revoke insert, update, delete, truncate, references, trigger on public.hub_event_series from authenticated;
grant select on public.hub_event_series to authenticated;

-- public badge info for approved series ("Weekly · Fri")
create view public.public_event_series as
  select series_id, kind, freq, weekday, monthly_nth, local_time, tz, status
    from public.hub_event_series where review_status = 'approved';
grant select on public.public_event_series to anon, authenticated;

-- 2) dates
alter table public.hub_events add column series_id uuid references public.hub_event_series(series_id) on delete set null;
alter table public.hub_events add column occurs_on date;
alter table public.hub_events add column series_override boolean not null default false;
alter table public.hub_events add column series_counted boolean not null default false;
create unique index hub_events_series_date on public.hub_events(series_id, occurs_on) where series_id is not null;

-- 3) date math
create or replace function public.series_dates(p_freq text, p_anchor date, p_nth smallint, p_weekday smallint, p_from date, p_n integer)
 returns setof date language plpgsql immutable as $$
declare d date; m date; c integer := 0; step integer;
begin
  if p_freq in ('weekly', 'biweekly') then
    step := case p_freq when 'weekly' then 7 else 14 end;
    d := p_anchor;
    if p_from > d then d := p_anchor + (ceil((p_from - p_anchor)::numeric / step) * step)::integer; end if;
    while c < p_n loop return next d; c := c + 1; d := d + step; end loop;
  else
    m := date_trunc('month', greatest(p_anchor, p_from))::date;
    while c < p_n loop
      if p_nth = -1 then
        d := (m + interval '1 month' - interval '1 day')::date;
        d := d - ((extract(isodow from d)::integer - p_weekday + 7) % 7);
      else
        d := m + ((p_weekday - extract(isodow from m)::integer + 7) % 7) + (p_nth - 1) * 7;
      end if;
      if d >= p_from and d >= p_anchor then return next d; c := c + 1; end if;
      m := (m + interval '1 month')::date;
    end loop;
  end if;
end $$;

-- keep 4 upcoming dates (not before launch; series still in review: only dates >= 24 h away)
create or replace function public.series_fill(p_series uuid)
 returns integer language plpgsql security definer set search_path to 'public' as $$
declare
  s public.hub_event_series; n integer; d date; st timestamptz; from_d date; added integer := 0;
  earliest timestamptz;
begin
  select * into s from public.hub_event_series where series_id = p_series for update;
  if not found or s.status <> 'active' or s.review_status in ('rejected', 'expired') then return 0; end if;
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

-- 4) limits shared by events and series (DEC-0209: a series counts as 1)
create or replace function public.event_host_open_count(p_driver uuid)
 returns integer language sql stable security definer set search_path to 'public' as $$
  select (select count(*) from public.hub_events where created_by = p_driver and series_id is null
            and review_status in ('pending','needs_changes') and starts_at > now())::integer
       + (select count(*) from public.hub_event_series where created_by = p_driver and status = 'active'
            and review_status in ('pending','needs_changes'))::integer;
$$;
create or replace function public.event_host_day_count(p_driver uuid)
 returns integer language sql stable security definer set search_path to 'public' as $$
  select (select count(*) from public.hub_events where created_by = p_driver and series_id is null and created_at > now() - interval '24 hours')::integer
       + (select count(*) from public.hub_event_series where created_by = p_driver and created_at > now() - interval '24 hours')::integer;
$$;

-- 5) review trigger: same as before, plus series dates and the shared counts
create or replace function public.hub_events_review()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := public.current_driver_id();
  sys boolean := coalesce(current_setting('lr.event_review', true), '') = 'on'
              or coalesce(current_setting('lr.event_sync', true), '') = 'on';
  h public.event_hosts; n integer; lim integer; pend jsonb; was jsonb; f text;
begin
  if sys or public.is_moderator() then
    if new.review_status <> 'approved' then new.is_published := false; end if;
    return new;
  end if;
  h := public.event_host_row(me);
  perform pg_advisory_xact_lock(hashtext('event_host:' || me::text));

  if tg_op = 'INSERT' then
    if new.series_id is not null then
      raise exception 'series_only: dates of a series are added by the series' using errcode = 'P0001';
    end if;
    if h.blocked then
      raise exception 'host_blocked: you can''t submit events right now' using errcode = 'P0001';
    end if;
    if h.level = 3 then
      n := public.event_host_day_count(me);
      if n >= h.daily_limit then
        raise exception 'daily_limit: you can create % events per 24 hours', h.daily_limit using errcode = 'P0001';
      end if;
      new.review_status := 'approved';
    else
      if new.starts_at < now() + interval '24 hours' then
        raise exception 'lead_time: the event has to start at least 24 hours from now' using errcode = 'P0001';
      end if;
      n := public.event_host_open_count(me);
      lim := 3;
      if h.level = 1 then lim := 1; end if;
      if n >= lim then
        raise exception 'open_limit: you can have % event(s) in review at a time', lim using errcode = 'P0001';
      end if;
      new.review_status := 'pending';
    end if;
    new.is_published := new.review_status = 'approved';
    return new;
  end if;

  -- UPDATE by the host
  new.review_status := old.review_status;
  if old.review_status in ('rejected','expired') then
    raise exception 'not_editable: this event can''t be changed any more' using errcode = 'P0001';
  end if;

  -- a date of a series: only time, sign-ups open/closed and cancelling; the rest belongs to the series
  if old.series_id is not null then
    new.series_id := old.series_id; new.occurs_on := old.occurs_on; new.series_counted := old.series_counted;
    if (new.title, new.description, new.discord_url, new.event_type, new.platforms, new.host_name, new.host_crew_id,
        new.location, new.members_only, new.max_participants)
       is distinct from
       (old.title, old.description, old.discord_url, old.event_type, old.platforms, old.host_name, old.host_crew_id,
        old.location, old.members_only, old.max_participants) then
      raise exception 'edit_series: change this in the series, it applies to all upcoming dates' using errcode = 'P0001';
    end if;
    if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) then
      if (h.level < 3 or h.blocked) and (old.starts_at < now() + interval '24 hours' or new.starts_at < now() + interval '24 hours') then
        raise exception 'time_locked: the time can only change while the event is at least 24 hours away' using errcode = 'P0001';
      end if;
      new.series_override := true;
    end if;
    if new.review_status <> 'approved' then new.is_published := false; end if;
    return new;
  end if;

  if old.review_status = 'approved' then
    if h.level < 3 or h.blocked then
      if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at)
         and (old.starts_at < now() + interval '24 hours' or new.starts_at < now() + interval '24 hours') then
        raise exception 'time_locked: the time can only change while the event is at least 24 hours away' using errcode = 'P0001';
      end if;
      select r.pending into was from public.hub_event_reviews r where r.event_id = old.event_id;
      pend := coalesce(was, '{}'::jsonb);
      foreach f in array array['title','description','discord_url'] loop
        if (to_jsonb(new) -> f) is distinct from (to_jsonb(old) -> f) then
          pend := pend || jsonb_build_object(f, to_jsonb(new) -> f);
        end if;
      end loop;
      new.title := old.title; new.description := old.description; new.discord_url := old.discord_url;
      if pend = '{}'::jsonb then pend := null; end if;
      if pend is distinct from was then
        insert into public.hub_event_reviews (event_id, pending, pending_since, edit_note)
        values (old.event_id, pend, case when pend is not null then now() end, null)
        on conflict (event_id) do update set pending = excluded.pending, pending_since = excluded.pending_since,
          edit_note = null, updated_at = now();
        if pend is not null then perform public.event_review_alert('Event changes submitted', new); end if;
      end if;
    end if;
  elsif old.review_status = 'pending' then
    if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at) and new.starts_at < now() + interval '24 hours' then
      raise exception 'lead_time: the event has to start at least 24 hours from now' using errcode = 'P0001';
    end if;
  elsif old.review_status = 'needs_changes' then
    if new.starts_at < now() + interval '24 hours' then
      raise exception 'lead_time: the event has to start at least 24 hours from now' using errcode = 'P0001';
    end if;
    new.review_status := 'pending';
    insert into public.hub_event_reviews (event_id, submitted_at) values (old.event_id, now())
    on conflict (event_id) do update set submitted_at = now(), updated_at = now();
    perform public.event_review_alert('Event resubmitted', new);
  end if;

  if new.review_status <> 'approved' then new.is_published := false; end if;
  return new;
end $$;

-- dates of a series are cancelled, not deleted (the job would add them again)
create or replace function public.hub_events_series_no_delete()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.series_id is not null
     and coalesce(current_setting('lr.event_review', true), '') <> 'on'
     and coalesce(current_setting('lr.event_sync', true), '') <> 'on'
     and not public.is_moderator()
     and public.current_driver_id() is not null then
    raise exception 'cancel_instead: dates of a series can be cancelled, not deleted' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger hub_events_series_no_delete before delete on public.hub_events
  for each row execute function public.hub_events_series_no_delete();

-- 6) host: create / change / end / keep running
create or replace function public.series_from_json(s public.hub_event_series, p jsonb)
 returns public.hub_event_series language plpgsql immutable as $$
begin
  if p ? 'title' then s.title := btrim(p->>'title'); end if;
  if p ? 'description' then s.description := nullif(btrim(coalesce(p->>'description', '')), ''); end if;
  if p ? 'event_type' then s.event_type := p->>'event_type'; end if;
  if p ? 'platforms' then s.platforms := array(select jsonb_array_elements_text(p->'platforms')); end if;
  if p ? 'host_name' then s.host_name := nullif(btrim(coalesce(p->>'host_name', '')), ''); end if;
  if p ? 'host_crew_id' then s.host_crew_id := nullif(p->>'host_crew_id', '')::uuid; end if;
  if p ? 'location' then s.location := nullif(p->>'location', ''); end if;
  if p ? 'discord_url' then s.discord_url := nullif(btrim(coalesce(p->>'discord_url', '')), ''); end if;
  if p ? 'max_participants' then s.max_participants := nullif(p->>'max_participants', '')::integer; end if;
  if p ? 'registration' then s.registration := p->>'registration'; end if;
  if p ? 'members_only' then s.members_only := coalesce((p->>'members_only')::boolean, false); end if;
  if p ? 'freq' then s.freq := p->>'freq'; end if;
  if p ? 'monthly_nth' then s.monthly_nth := nullif(p->>'monthly_nth', '')::smallint; end if;
  if p ? 'weekday' then s.weekday := nullif(p->>'weekday', '')::smallint; end if;
  if p ? 'anchor_date' then s.anchor_date := (p->>'anchor_date')::date; end if;
  if p ? 'local_time' then s.local_time := (p->>'local_time')::time; end if;
  if p ? 'tz' then s.tz := coalesce(nullif(p->>'tz', ''), 'UTC'); end if;
  if p ? 'duration_min' then s.duration_min := nullif(p->>'duration_min', '')::integer; end if;
  if s.freq <> 'monthly' then s.monthly_nth := null; s.weekday := extract(isodow from s.anchor_date)::smallint; end if;
  if s.host_crew_id is null then s.members_only := false; end if;
  return s;
end $$;

create or replace function public.series_check(s public.hub_event_series)
 returns void language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from pg_timezone_names where name = s.tz) then
    raise exception 'invalid_tz: unknown time zone' using errcode = 'P0001';
  end if;
  if s.host_crew_id is not null and not public.can_host_for_crew(s.host_crew_id) then
    raise exception 'not_crew_staff: only crews you lead or co-run' using errcode = 'P0001';
  end if;
  if s.host_name is null and s.discord_url is null and not exists (
       select 1 from public.crews c where c.crew_id = s.host_crew_id and c.discord_url is not null) then
    raise exception 'contact_required: add your PSN name or a Discord invite (or pick a host crew that has one)' using errcode = 'P0001';
  end if;
end $$;

create or replace function public.create_event_series(p jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := public.current_driver_id(); h public.event_hosts; s public.hub_event_series; n integer; lim integer;
begin
  if me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  h := public.event_host_row(me);
  perform pg_advisory_xact_lock(hashtext('event_host:' || me::text));
  if h.blocked and not public.is_moderator() then
    raise exception 'host_blocked: you can''t submit events right now' using errcode = 'P0001';
  end if;
  s.series_id := gen_random_uuid(); s.kind := 'recurring'; s.created_by := me; s.status := 'active';
  s.platforms := '{ps5}'; s.registration := 'open'; s.members_only := false; s.tz := 'UTC'; s.empty_count := 0;
  s.changes_requested := false; s.created_at := now(); s.updated_at := now(); s.submitted_at := now();
  s := public.series_from_json(s, p);
  perform public.series_check(s);
  select count(*) into n from public.hub_event_series where created_by = me and kind = 'recurring' and status = 'active'
     and review_status not in ('rejected','expired');
  if n >= 3 and not public.is_moderator() then
    raise exception 'series_limit: you can run up to 3 series at a time' using errcode = 'P0001';
  end if;
  if public.is_moderator() then
    s.review_status := 'approved';
  elsif h.level = 3 then
    if public.event_host_day_count(me) >= h.daily_limit then
      raise exception 'daily_limit: you can create % events per 24 hours', h.daily_limit using errcode = 'P0001';
    end if;
    s.review_status := 'approved';
  else
    lim := 3; if h.level = 1 then lim := 1; end if;
    if public.event_host_open_count(me) >= lim then
      raise exception 'open_limit: you can have % event(s) in review at a time', lim using errcode = 'P0001';
    end if;
    s.review_status := 'pending';
  end if;
  insert into public.hub_event_series select s.*;
  perform public.series_fill(s.series_id);
  if s.review_status = 'pending' then
    insert into public.discord_mod_alerts (kind, actor, detail, link)
    select 'Series submitted (stage ' || h.level || ')', d.display_name, left(s.title, 80), 'moderator/hub/'
      from public.drivers d where d.driver_id = me;
  end if;
  return jsonb_build_object('status', 'ok', 'series_id', s.series_id, 'review_status', s.review_status,
    'dates', (select count(*) from public.hub_events where series_id = s.series_id));
end $$;

-- copy the template to upcoming dates (dates already moved by hand keep their time)
create or replace function public.series_push(p_series uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare s public.hub_event_series;
begin
  select * into s from public.hub_event_series where series_id = p_series;
  perform set_config('lr.event_review', 'on', true);
  perform set_config('lr.event_sync', 'on', true);
  update public.hub_events e
     set title = s.title, description = s.description, event_type = s.event_type, platforms = s.platforms,
         host_name = s.host_name, host_crew_id = s.host_crew_id, location = s.location, discord_url = s.discord_url,
         max_participants = s.max_participants, members_only = s.members_only
   where e.series_id = p_series and e.starts_at > now();
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
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
  rule_changed := (s.freq, s.weekday, s.monthly_nth, s.anchor_date, s.local_time, s.tz, s.duration_min)
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
  if s.registration is distinct from o.registration then
    perform set_config('lr.event_review', 'on', true);
    perform set_config('lr.event_sync', 'on', true);
    update public.hub_events set registration = s.registration where series_id = p_series and starts_at > now();
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

-- end the series: upcoming dates without sign-ups go, dates with sign-ups are cancelled
create or replace function public.series_close(p_series uuid, p_status text)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('lr.event_review', 'on', true);
  perform set_config('lr.event_sync', 'on', true);
  update public.hub_event_series set status = p_status, ended_at = now(), updated_at = now() where series_id = p_series;
  delete from public.hub_events e where e.series_id = p_series and e.starts_at > now()
     and not exists (select 1 from public.hub_event_rsvps v where v.event_id = e.event_id);
  update public.hub_events set status = 'cancelled' where series_id = p_series and starts_at > now();
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
end $$;

create or replace function public.end_event_series(p_series uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.hub_event_series where series_id = p_series and status = 'active'
                   and (created_by = public.current_driver_id() or public.is_moderator())) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform public.series_close(p_series, 'ended');
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.keep_event_series(p_series uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  update public.hub_event_series set empty_count = 0, warned_at = null, mod_alert_at = null, updated_at = now()
   where series_id = p_series and status = 'active' and (created_by = public.current_driver_id() or public.is_moderator());
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('status', 'ok');
end $$;

-- 7) moderators
create or replace function public.moderate_series(p_series uuid, p_action text, p_note text default null)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := public.current_driver_id(); s public.hub_event_series; h public.event_hosts;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action not in ('approve','needs_changes','reject','approve_changes','reject_changes','keep','cancel') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if p_action in ('needs_changes','reject','reject_changes','cancel') and v_note is null then
    raise exception 'note_required: add a reason for the host' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 300 then raise exception 'note_too_long' using errcode = 'P0001'; end if;
  select * into s from public.hub_event_series where series_id = p_series for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;

  if p_action in ('approve','needs_changes','reject') then
    if s.review_status not in ('pending','needs_changes') then raise exception 'not_in_review' using errcode = 'P0001'; end if;
    update public.hub_event_series
       set review_status = case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_changes' end,
           reviewed_at = now(), reviewed_by = me, note = case when p_action = 'approve' then null else v_note end,
           changes_requested = changes_requested or p_action = 'needs_changes',
           status = case when p_action = 'reject' then 'ended' else status end, updated_at = now()
     where series_id = p_series;
    perform set_config('lr.event_review', 'on', true);
    perform set_config('lr.event_sync', 'on', true);
    update public.hub_events
       set review_status = case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'pending' end,
           is_published = (p_action = 'approve')
     where series_id = p_series and starts_at > now() and review_status <> 'expired';
    perform set_config('lr.event_review', '', true);
    perform set_config('lr.event_sync', '', true);
    if s.created_by is not null and p_action <> 'needs_changes' then
      h := public.event_host_row(s.created_by);
      if p_action = 'approve' then
        update public.event_hosts
           set level = case when level = 1 and not blocked then 2 else level end,
               clean_approvals = clean_approvals + case when s.changes_requested then 0 else 1 end, updated_at = now()
         where driver_id = s.created_by returning * into h;
        perform public.event_host_sync_role(s.created_by, me);
        if h.level = 2 and not h.blocked and h.clean_approvals >= 5 and h.stage3_suggested_at is null then
          update public.event_hosts set stage3_suggested_at = now() where driver_id = s.created_by;
          insert into public.discord_mod_alerts (kind, actor, detail, link)
          select 'Suggest stage 3 (trusted host)', d.display_name, h.clean_approvals || ' events approved without changes', 'moderator/hub/'
            from public.drivers d where d.driver_id = s.created_by;
        end if;
        perform public.series_fill(p_series);
      else
        update public.event_hosts set clean_approvals = 0, updated_at = now() where driver_id = s.created_by;
      end if;
    end if;
  elsif p_action in ('approve_changes','reject_changes') then
    if s.pending is null then raise exception 'no_pending_changes' using errcode = 'P0001'; end if;
    if p_action = 'approve_changes' then
      update public.hub_event_series
         set title = case when s.pending ? 'title' then s.pending ->> 'title' else title end,
             description = case when s.pending ? 'description' then s.pending ->> 'description' else description end,
             discord_url = case when s.pending ? 'discord_url' then s.pending ->> 'discord_url' else discord_url end
       where series_id = p_series;
      perform public.series_push(p_series);
    end if;
    update public.hub_event_series
       set pending = null, pending_since = null, reviewed_at = now(), reviewed_by = me,
           edit_note = case when p_action = 'reject_changes' then v_note end, updated_at = now()
     where series_id = p_series;
  elsif p_action = 'keep' then
    update public.hub_event_series set empty_count = 0, warned_at = null, mod_alert_at = null, updated_at = now() where series_id = p_series;
  else -- cancel (dates without sign-ups for a while): the host sees the reason in the account
    update public.hub_event_series set note = v_note, reviewed_at = now(), reviewed_by = me where series_id = p_series;
    perform public.series_close(p_series, 'cancelled');
  end if;
  return jsonb_build_object('status', 'ok', 'action', p_action);
end $$;

-- 8) host status with series
create or replace function public.my_event_host_status()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare me uuid := public.current_driver_id(); h public.event_hosts; lvl integer; open_n integer; day_n integer; ser_n integer;
begin
  if me is null then return null; end if;
  select * into h from public.event_hosts where driver_id = me;
  lvl := coalesce(h.level, case when exists (select 1 from public.hub_roles where driver_id = me and role = 'event_host') then 2 else 1 end);
  open_n := public.event_host_open_count(me);
  day_n := public.event_host_day_count(me);
  select count(*) into ser_n from public.hub_event_series where created_by = me and kind = 'recurring' and status = 'active'
     and review_status not in ('rejected','expired');
  return jsonb_build_object('level', lvl, 'blocked', coalesce(h.blocked, false),
    'open', open_n, 'open_limit', case when lvl = 3 then null when lvl = 1 then 1 else 3 end,
    'daily_limit', case when lvl = 3 then coalesce(h.daily_limit, 3) end, 'created_24h', day_n,
    'lead_hours', case when lvl = 3 then 0 else 24 end, 'series', ser_n, 'series_limit', 3);
end $$;

-- 9) hourly: count past dates, notes / mod alerts, keep 4 dates, tell the bot about the next date
create or replace function public.series_housekeeping()
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare r record; nx uuid; added integer := 0; alerts integer := 0;
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
  update public.hub_event_series set warned_at = now() where status = 'active' and empty_count >= 2 and warned_at is null;
  for r in select s.series_id, s.title, d.display_name from public.hub_event_series s left join public.drivers d on d.driver_id = s.created_by
            where s.status = 'active' and s.empty_count >= 3 and s.mod_alert_at is null loop
    insert into public.discord_mod_alerts (kind, actor, detail, link)
    values ('Series: 3 dates without sign-ups', r.display_name, left(r.title, 80), 'moderator/hub/');
    update public.hub_event_series set mod_alert_at = now() where series_id = r.series_id;
    alerts := alerts + 1;
  end loop;
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
  for r in select series_id from public.hub_event_series where status = 'active' and review_status not in ('rejected','expired') loop
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
  return jsonb_build_object('dates_added', added, 'mod_alerts', alerts);
end $$;

select cron.schedule('event-series-hourly', '13 * * * *', 'select public.series_housekeeping();');

revoke all on function public.series_dates(text, date, smallint, smallint, date, integer), public.series_fill(uuid),
  public.event_host_open_count(uuid), public.event_host_day_count(uuid), public.hub_events_series_no_delete(),
  public.series_from_json(public.hub_event_series, jsonb), public.series_check(public.hub_event_series),
  public.series_push(uuid), public.series_close(uuid, text), public.series_housekeeping()
  from public, anon, authenticated;
revoke all on function public.create_event_series(jsonb), public.update_event_series(uuid, jsonb), public.end_event_series(uuid),
  public.keep_event_series(uuid), public.moderate_series(uuid, text, text) from public, anon;
grant execute on function public.create_event_series(jsonb), public.update_event_series(uuid, jsonb), public.end_event_series(uuid),
  public.keep_event_series(uuid), public.moderate_series(uuid, text, text) to authenticated;
