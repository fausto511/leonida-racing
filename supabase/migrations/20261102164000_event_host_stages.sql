-- RS-0097 / DEC-0137 + DEC-0209: event host stages.
-- Everyone with an account can submit events. Stage 1: max 1 open submission, each reviewed;
-- the first approval moves the host to stage 2 and grants the event_host role. Stage 2: max 3
-- open, each reviewed; after 5 clean approvals #mod-alerts suggests stage 3. Stage 3 (set by
-- a moderator): publishes without review, max daily_limit new events per 24 h.
-- Stage 1/2: start >= 24 h after submitting; unreviewed submissions expire when the start
-- passes. Title/description/Discord invite edits of live stage-1/2 events wait for review
-- (old version stays live); time edits only while >= 24 h to the start.
-- Review notes and pending edits live in hub_event_reviews (not readable by the public).

-- 1) hosts
create table public.event_hosts (
  driver_id uuid primary key references public.drivers(driver_id) on delete cascade,
  level smallint not null default 1 check (level between 1 and 3),
  blocked boolean not null default false,
  daily_limit smallint not null default 3 check (daily_limit between 1 and 20),
  clean_approvals integer not null default 0,
  stage3_suggested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.drivers(driver_id) on delete set null
);
alter table public.event_hosts enable row level security;
create policy event_hosts_read on public.event_hosts for select to authenticated
  using (driver_id = public.current_driver_id() or public.is_moderator());
revoke all on public.event_hosts from anon;
revoke insert, update, delete, truncate, references, trigger on public.event_hosts from authenticated;
grant select on public.event_hosts to authenticated;

-- existing hosts start at stage 2
insert into public.event_hosts (driver_id, level)
select distinct driver_id, 2 from public.hub_roles where role = 'event_host'
on conflict do nothing;

-- 2) review state on the event (public, harmless) + details in a private side table
alter table public.hub_events add column review_status text not null default 'approved'
  check (review_status in ('pending','needs_changes','rejected','expired','approved'));
create index hub_events_review_open on public.hub_events(created_by) where review_status in ('pending','needs_changes');

create table public.hub_event_reviews (
  event_id uuid primary key references public.hub_events(event_id) on delete cascade,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.drivers(driver_id) on delete set null,
  note text check (note is null or char_length(note) <= 300),
  changes_requested boolean not null default false,
  pending jsonb,
  pending_since timestamptz,
  edit_note text check (edit_note is null or char_length(edit_note) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.hub_event_reviews enable row level security;
create policy hub_event_reviews_read on public.hub_event_reviews for select to authenticated
  using (public.is_moderator() or exists (select 1 from public.hub_events e
           where e.event_id = hub_event_reviews.event_id and e.created_by = public.current_driver_id()));
revoke all on public.hub_event_reviews from anon;
revoke insert, update, delete, truncate, references, trigger on public.hub_event_reviews from authenticated;
grant select on public.hub_event_reviews to authenticated;

-- 3) helpers
create or replace function public.event_host_row(p_driver uuid)
 returns public.event_hosts language plpgsql security definer set search_path to 'public' as $$
declare h public.event_hosts;
begin
  select * into h from public.event_hosts where driver_id = p_driver;
  if not found then
    insert into public.event_hosts (driver_id, level)
    values (p_driver, case when exists (select 1 from public.hub_roles where driver_id = p_driver and role = 'event_host') then 2 else 1 end)
    on conflict (driver_id) do nothing;
    select * into h from public.event_hosts where driver_id = p_driver;
  end if;
  return h;
end $$;

-- event_host role (website badge, Discord role, /ping) iff stage >= 2 and not blocked
create or replace function public.event_host_sync_role(p_driver uuid, p_by uuid)
 returns void language plpgsql security definer set search_path to 'public' as $$
declare h public.event_hosts;
begin
  select * into h from public.event_hosts where driver_id = p_driver;
  perform set_config('lr.host_sync', 'on', true);
  if h.driver_id is not null and h.level >= 2 and not h.blocked then
    insert into public.hub_roles (driver_id, role, granted_by)
    select p_driver, 'event_host', p_by
     where not exists (select 1 from public.hub_roles where driver_id = p_driver and role = 'event_host');
  else
    delete from public.hub_roles where driver_id = p_driver and role = 'event_host';
  end if;
  perform set_config('lr.host_sync', '', true);
end $$;

create or replace function public.event_review_alert(p_kind text, p_event public.hub_events)
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.discord_mod_alerts (kind, actor, detail, link)
  select p_kind, d.display_name,
         left(p_event.title, 80) || ' · ' || to_char(p_event.starts_at at time zone 'UTC', 'DD Mon HH24:MI') || ' UTC',
         'moderator/hub/'
    from (select 1) x left join public.drivers d on d.driver_id = p_event.created_by;
exception when others then
  raise warning 'event_review_alert: %', sqlerrm;
end $$;

-- 4) review rules (fires after the other BEFORE triggers: alphabetical order)
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
    if h.blocked then
      raise exception 'host_blocked: you can''t submit events right now' using errcode = 'P0001';
    end if;
    if h.level = 3 then
      select count(*) into n from public.hub_events where created_by = me and created_at > now() - interval '24 hours';
      if n >= h.daily_limit then
        raise exception 'daily_limit: you can create % events per 24 hours', h.daily_limit using errcode = 'P0001';
      end if;
      new.review_status := 'approved';
    else
      if new.starts_at < now() + interval '24 hours' then
        raise exception 'lead_time: the event has to start at least 24 hours from now' using errcode = 'P0001';
      end if;
      select count(*) into n from public.hub_events
       where created_by = me and review_status in ('pending','needs_changes') and starts_at > now();
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

create trigger hub_events_review before insert or update on public.hub_events
  for each row execute function public.hub_events_review();

create or replace function public.hub_events_review_created()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
declare h public.event_hosts;
begin
  if new.review_status = 'pending' then
    insert into public.hub_event_reviews (event_id, submitted_at) values (new.event_id, now())
    on conflict (event_id) do update set submitted_at = now(), updated_at = now();
    select * into h from public.event_hosts where driver_id = new.created_by;
    perform public.event_review_alert('Event submitted (stage ' || coalesce(h.level, 1) || ')', new);
  end if;
  return null;
end $$;

create trigger hub_events_review_created after insert on public.hub_events
  for each row execute function public.hub_events_review_created();

-- 5) policies: any account may create/edit its own events (rules above); streams same
drop policy hub_events_host_insert on public.hub_events;
create policy hub_events_host_insert on public.hub_events for insert to authenticated
  with check (created_by = public.current_driver_id() and (host_crew_id is null or public.can_host_for_crew(host_crew_id)));
drop policy hub_events_host_update on public.hub_events;
create policy hub_events_host_update on public.hub_events for update to authenticated
  using (created_by = public.current_driver_id())
  with check (created_by = public.current_driver_id() and (host_crew_id is null or public.can_host_for_crew(host_crew_id)));
drop policy hub_event_streams_host_write on public.hub_event_streams;
create policy hub_event_streams_host_write on public.hub_event_streams for all
  using (public.is_moderator() or exists (select 1 from public.hub_events e
           where e.event_id = hub_event_streams.event_id and e.created_by = public.current_driver_id()))
  with check (public.is_moderator() or exists (select 1 from public.hub_events e
           where e.event_id = hub_event_streams.event_id and e.created_by = public.current_driver_id()));

-- the host application is gone (crew leader / creator applications stay)
create or replace function public.hub_role_requests_no_event_host()
 returns trigger language plpgsql set search_path to 'public' as $$
begin
  if new.role = 'event_host' then
    raise exception 'event_host_requests_closed: submit an event under My Account > Events instead' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger hub_role_requests_no_event_host before insert on public.hub_role_requests
  for each row execute function public.hub_role_requests_no_event_host();

-- role granted/removed by hand (moderator hub roles UI) keeps the stage in step
create or replace function public.hub_roles_event_host_stage()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if coalesce(current_setting('lr.host_sync', true), '') = 'on' then return null; end if;
  if tg_op = 'INSERT' and new.role = 'event_host' then
    insert into public.event_hosts (driver_id, level) values (new.driver_id, 2)
    on conflict (driver_id) do update set level = greatest(public.event_hosts.level, 2), updated_at = now();
  elsif tg_op = 'DELETE' and old.role = 'event_host' then
    update public.event_hosts set level = 1, clean_approvals = 0, stage3_suggested_at = null, updated_at = now()
     where driver_id = old.driver_id and level > 1;
  end if;
  return null;
end $$;
create trigger hub_roles_event_host_stage after insert or delete on public.hub_roles
  for each row execute function public.hub_roles_event_host_stage();

-- 6) moderator actions
create or replace function public.moderate_event(p_event uuid, p_action text, p_note text default null)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := public.current_driver_id(); e public.hub_events; r public.hub_event_reviews; h public.event_hosts;
  v_note text := nullif(btrim(coalesce(p_note, '')), ''); pend jsonb;
begin
  if not public.is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_action not in ('approve','needs_changes','reject','approve_changes','reject_changes') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  if p_action in ('needs_changes','reject','reject_changes') and v_note is null then
    raise exception 'note_required: add a reason for the host' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 300 then raise exception 'note_too_long' using errcode = 'P0001'; end if;
  select * into e from public.hub_events where event_id = p_event for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into r from public.hub_event_reviews where event_id = p_event;
  perform set_config('lr.event_review', 'on', true);

  if p_action in ('approve','needs_changes','reject') then
    if e.review_status not in ('pending','needs_changes') then raise exception 'not_in_review' using errcode = 'P0001'; end if;
    if p_action = 'approve' and e.starts_at <= now() then raise exception 'already_started' using errcode = 'P0001'; end if;
    update public.hub_events
       set review_status = case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_changes' end,
           is_published = (p_action = 'approve')
     where event_id = p_event;
    insert into public.hub_event_reviews (event_id, reviewed_at, reviewed_by, note, changes_requested)
    values (p_event, now(), me, case when p_action = 'approve' then null else v_note end, p_action = 'needs_changes')
    on conflict (event_id) do update set reviewed_at = now(), reviewed_by = me,
      note = case when p_action = 'approve' then null else v_note end,
      changes_requested = public.hub_event_reviews.changes_requested or p_action = 'needs_changes',
      updated_at = now();
    if e.created_by is not null and p_action <> 'needs_changes' then
      h := public.event_host_row(e.created_by);
      if p_action = 'approve' then
        update public.event_hosts
           set level = case when level = 1 and not blocked then 2 else level end,
               clean_approvals = clean_approvals + case when coalesce(r.changes_requested, false) then 0 else 1 end,
               updated_at = now()
         where driver_id = e.created_by returning * into h;
        perform public.event_host_sync_role(e.created_by, me);
        if h.level = 2 and not h.blocked and h.clean_approvals >= 5 and h.stage3_suggested_at is null then
          update public.event_hosts set stage3_suggested_at = now() where driver_id = e.created_by;
          insert into public.discord_mod_alerts (kind, actor, detail, link)
          select 'Suggest stage 3 (trusted host)', d.display_name, h.clean_approvals || ' events approved without changes', 'moderator/hub/'
            from public.drivers d where d.driver_id = e.created_by;
        end if;
      else
        update public.event_hosts set clean_approvals = 0, updated_at = now() where driver_id = e.created_by;
      end if;
    end if;
  else
    if e.review_status <> 'approved' or r.pending is null then raise exception 'no_pending_changes' using errcode = 'P0001'; end if;
    pend := r.pending;
    if p_action = 'approve_changes' then
      update public.hub_events
         set title = case when pend ? 'title' then pend ->> 'title' else title end,
             description = case when pend ? 'description' then pend ->> 'description' else description end,
             discord_url = case when pend ? 'discord_url' then pend ->> 'discord_url' else discord_url end
       where event_id = p_event;
    end if;
    update public.hub_event_reviews
       set pending = null, pending_since = null, reviewed_at = now(), reviewed_by = me,
           edit_note = case when p_action = 'reject_changes' then v_note end, updated_at = now()
     where event_id = p_event;
  end if;
  perform set_config('lr.event_review', '', true);
  return jsonb_build_object('status', 'ok', 'action', p_action);
end $$;

create or replace function public.set_event_host(p_driver uuid, p_level integer default null, p_blocked boolean default null, p_daily_limit integer default null)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare me uuid := public.current_driver_id(); h public.event_hosts; down boolean;
begin
  if not public.is_moderator() then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.drivers where driver_id = p_driver and deleted_at is null) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  h := public.event_host_row(p_driver);
  down := p_level is not null and p_level < h.level;
  update public.event_hosts
     set level = coalesce(p_level, level), blocked = coalesce(p_blocked, blocked),
         daily_limit = coalesce(p_daily_limit, daily_limit),
         clean_approvals = case when down then 0 else clean_approvals end,
         stage3_suggested_at = case when down then null else stage3_suggested_at end,
         updated_at = now(), updated_by = me
   where driver_id = p_driver returning * into h;
  perform public.event_host_sync_role(p_driver, me);
  return to_jsonb(h);
end $$;

-- host withdraws edits that wait for review (the live version stays)
create or replace function public.withdraw_event_changes(p_event uuid)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
begin
  if not exists (select 1 from public.hub_events where event_id = p_event and created_by = public.current_driver_id()) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update public.hub_event_reviews set pending = null, pending_since = null, updated_at = now() where event_id = p_event;
  return jsonb_build_object('status', 'ok');
end $$;

-- 7) host's own status for the account page
create or replace function public.my_event_host_status()
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare me uuid := public.current_driver_id(); h public.event_hosts; lvl integer; open_n integer; day_n integer;
begin
  if me is null then return null; end if;
  select * into h from public.event_hosts where driver_id = me;
  lvl := coalesce(h.level, case when exists (select 1 from public.hub_roles where driver_id = me and role = 'event_host') then 2 else 1 end);
  select count(*) into open_n from public.hub_events where created_by = me and review_status in ('pending','needs_changes') and starts_at > now();
  select count(*) into day_n from public.hub_events where created_by = me and created_at > now() - interval '24 hours';
  return jsonb_build_object('level', lvl, 'blocked', coalesce(h.blocked, false),
    'open', open_n, 'open_limit', case when lvl = 3 then null when lvl = 1 then 1 else 3 end,
    'daily_limit', case when lvl = 3 then coalesce(h.daily_limit, 3) end, 'created_24h', day_n,
    'lead_hours', case when lvl = 3 then 0 else 24 end);
end $$;

-- 8) hourly: expire unreviewed submissions whose start passed, drop stale pending edits,
--    delete rejected/expired submissions after 30 days
create or replace function public.hub_events_review_housekeeping()
 returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform set_config('lr.event_review', 'on', true);
  perform set_config('lr.event_sync', 'on', true);
  update public.hub_events set review_status = 'expired', is_published = false
   where review_status in ('pending','needs_changes') and starts_at <= now();
  update public.hub_event_reviews r set pending = null, pending_since = null, updated_at = now()
    from public.hub_events e
   where e.event_id = r.event_id and r.pending is not null and e.starts_at <= now();
  delete from public.hub_events e
   where (e.review_status = 'expired' and e.starts_at < now() - interval '30 days')
      or (e.review_status = 'rejected' and coalesce((select r.reviewed_at from public.hub_event_reviews r where r.event_id = e.event_id), e.updated_at) < now() - interval '30 days');
  perform set_config('lr.event_review', '', true);
  perform set_config('lr.event_sync', '', true);
end $$;

select cron.schedule('hub-events-review-hourly', '7 * * * *', 'select public.hub_events_review_housekeeping();');

revoke all on function public.event_host_row(uuid), public.event_host_sync_role(uuid, uuid),
  public.event_review_alert(text, public.hub_events), public.hub_events_review(), public.hub_events_review_created(),
  public.hub_roles_event_host_stage(), public.hub_role_requests_no_event_host(), public.hub_events_review_housekeeping()
  from public, anon, authenticated;
revoke all on function public.moderate_event(uuid, text, text), public.set_event_host(uuid, integer, boolean, integer),
  public.my_event_host_status(), public.withdraw_event_changes(uuid) from public, anon;
grant execute on function public.moderate_event(uuid, text, text), public.set_event_host(uuid, integer, boolean, integer),
  public.my_event_host_status(), public.withdraw_event_changes(uuid) to authenticated;
