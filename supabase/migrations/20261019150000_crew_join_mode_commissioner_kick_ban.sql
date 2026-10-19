-- DEC-0144 (Fausto 19.10.2026): crew join mode (open / request), Commissioner role,
-- kick + ban for crews and events. Spec: Claude outputs/SPEC-Crew-Beitritt-Commissioner-Kick-Bann-2026-10-19.md
-- Applied 19.10. in several parts via MCP (part1, commissioner_guard, leader_cleanup, bans/join rules/policies, ...).
-- Backward compatible with the live site: default join_mode = 'request' keeps today's behaviour.

-- ---------------------------------------------------------------------------
-- 1. Join mode
-- ---------------------------------------------------------------------------
alter table public.crews
  add column if not exists join_mode text not null default 'request'
  constraint crews_join_mode_check check (join_mode in ('open', 'request'));

-- ---------------------------------------------------------------------------
-- 2. Commissioner role
-- ---------------------------------------------------------------------------
alter table public.hub_roles drop constraint hub_roles_role_check;
alter table public.hub_roles add constraint hub_roles_role_check
  check (role = any (array['crew_leader', 'crew_commissioner', 'event_host', 'creator']));
alter table public.hub_roles drop constraint hub_roles_crew_matches_role;
alter table public.hub_roles add constraint hub_roles_crew_matches_role
  check ((role in ('crew_leader', 'crew_commissioner')) = (crew_id is not null));

-- Leader or Commissioner of this crew (current user)
create or replace function public.is_crew_staff(target_crew uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.hub_roles r
    join public.drivers d on d.driver_id = r.driver_id
    where d.auth_user_id = auth.uid() and r.crew_id = target_crew
      and r.role in ('crew_leader', 'crew_commissioner')
  );
$$;

create or replace function public.is_crew_commissioner_of(p_crew uuid, p_driver uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.hub_roles where crew_id = p_crew and driver_id = p_driver and role = 'crew_commissioner');
$$;

create or replace function public.is_crew_leader_of(p_crew uuid, p_driver uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.hub_roles where crew_id = p_crew and driver_id = p_driver and role = 'crew_leader');
$$;

-- Leaving / losing active membership drops the crew role (leader and commissioner)
create or replace function public.crew_memberships_leader_cleanup()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.status = 'active' and (tg_op = 'DELETE' or new.status <> 'active') then
    delete from public.hub_roles
     where driver_id = old.driver_id and crew_id = old.crew_id and role in ('crew_leader', 'crew_commissioner');
  end if;
  return null;
end $$;

-- A Commissioner cannot remove another Commissioner (only the leader, a moderator or the person themself)
create or replace function public.crew_memberships_commissioner_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.status = 'active'
     and auth.uid() is not null  -- system jobs / cascades are not blocked
     and (tg_op = 'DELETE' or new.status is distinct from old.status)
     and old.driver_id is distinct from public.current_driver_id()
     and not public.is_moderator()
     and not public.is_crew_leader(old.crew_id)
     and public.is_crew_commissioner_of(old.crew_id, old.driver_id)
  then
    raise exception 'commissioner_protected: only the crew leader can remove a commissioner' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create or replace trigger crew_memberships_commissioner_guard
  before update or delete on public.crew_memberships
  for each row execute function public.crew_memberships_commissioner_guard();

-- ---------------------------------------------------------------------------
-- 3. Crew bans + join rules
-- ---------------------------------------------------------------------------
create table if not exists public.crew_bans (
  crew_id uuid not null references public.crews(crew_id) on delete cascade,
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  banned_by uuid references public.drivers(driver_id) on delete set null,
  banned_at timestamptz not null default now(),
  primary key (crew_id, driver_id)
);
alter table public.crew_bans enable row level security;
create policy crew_bans_select on public.crew_bans for select
  using (public.is_crew_staff(crew_id) or public.is_moderator());
create index if not exists crew_bans_driver_idx on public.crew_bans (driver_id);

-- Before insert: banned drivers can't join / request / be invited; a request to an open crew becomes active at once
create or replace function public.crew_memberships_join_rules()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.crew_bans b where b.crew_id = new.crew_id and b.driver_id = new.driver_id) then
    raise exception 'crew_banned: this driver is banned from this crew' using errcode = 'P0001';
  end if;
  if new.status in ('pending', 'active') and new.driver_id = public.current_driver_id()
     and (select c.join_mode from public.crews c where c.crew_id = new.crew_id) = 'open' then
    new.status := 'active';
    new.decided_at := now();
    new.decided_by := null;
  end if;
  return new;
end $$;
create or replace trigger crew_memberships_join_rules
  before insert on public.crew_memberships
  for each row execute function public.crew_memberships_join_rules();

-- Own insert: request (pending) for any published crew, or direct join (active) for an open crew
alter policy crew_memberships_request on public.crew_memberships
  with check (
    driver_id = public.current_driver_id()
    and decided_by is null
    and exists (select 1 from public.crews c where c.crew_id = crew_memberships.crew_id and c.is_published)
    and (
      (status = 'pending' and decided_at is null)
      or (status = 'active' and exists (select 1 from public.crews c where c.crew_id = crew_memberships.crew_id and c.join_mode = 'open'))
    )
  );

-- Switching request -> open accepts all open requests (Fausto 19.10.)
create or replace function public.crews_open_accept_pending()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.join_mode = 'open' and old.join_mode is distinct from 'open' then
    update public.crew_memberships
       set status = 'active', decided_at = now(), decided_by = public.current_driver_id()
     where crew_id = new.crew_id and status = 'pending';
  end if;
  return null;
end $$;
create or replace trigger crews_open_accept_pending
  after update of join_mode on public.crews
  for each row execute function public.crews_open_accept_pending();

-- ---------------------------------------------------------------------------
-- 4. Membership policies + views: leader -> leader or commissioner
-- ---------------------------------------------------------------------------
alter policy crew_memberships_decide on public.crew_memberships
  using (public.is_crew_staff(crew_id) or public.is_moderator())
  with check (public.is_crew_staff(crew_id) or public.is_moderator());

alter policy crew_memberships_delete on public.crew_memberships
  using (driver_id = public.current_driver_id() or public.is_crew_staff(crew_id) or public.is_moderator());

alter policy crew_memberships_invite on public.crew_memberships
  with check (
    status = 'invited' and invited_by = public.current_driver_id()
    and decided_at is null and decided_by is null
    and (public.is_crew_staff(crew_id) or public.is_moderator())
    and exists (select 1 from public.crews c where c.crew_id = crew_memberships.crew_id and c.is_published)
  );

alter policy crew_memberships_select on public.crew_memberships
  using (driver_id = public.current_driver_id() or public.is_crew_staff(crew_id) or public.is_moderator());

create or replace view public.crew_membership_overview as
 select m.membership_id, m.crew_id, c.name as crew_name, c.tag, c.color, c.slug,
        m.driver_id, d.display_name, m.status, m.requested_at, m.decided_at, m.is_primary,
        inv.display_name as invited_by_name
   from public.crew_memberships m
   join public.crews c on c.crew_id = m.crew_id
   join public.drivers d on d.driver_id = m.driver_id
   left join public.drivers inv on inv.driver_id = m.invited_by
  where d.deleted_at is null
    and (m.driver_id = public.current_driver_id() or public.is_crew_staff(m.crew_id) or public.is_moderator());

create or replace function public.search_drivers_for_invite(p_crew uuid, p_query text)
returns table(driver_id uuid, display_name text)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.is_crew_staff(p_crew) or public.is_moderator()) then raise exception 'not allowed'; end if;
  if char_length(btrim(coalesce(p_query, ''))) < 3 then return; end if;
  return query
    select d.driver_id, d.display_name from public.drivers d
    where d.deleted_at is null and d.display_name is not null
      and d.display_name ilike replace(replace(btrim(p_query), '%', ''), '_', '\_') || '%'
      and not exists (select 1 from public.crew_memberships m where m.crew_id = p_crew and m.driver_id = d.driver_id)
      and not exists (select 1 from public.crew_bans b where b.crew_id = p_crew and b.driver_id = d.driver_id)
    order by d.display_name limit 10;
end $$;

-- Public: who leads / co-runs a published crew (shown like the roster)
create or replace function public.crew_staff(p_crew uuid)
returns table(driver_id uuid, role text)
language sql stable security definer set search_path to 'public' as $$
  select r.driver_id, r.role from public.hub_roles r
  join public.crews c on c.crew_id = r.crew_id
  where r.crew_id = p_crew and r.role in ('crew_leader', 'crew_commissioner')
    and (c.is_published or public.is_crew_staff(p_crew) or public.is_moderator());
$$;

-- ---------------------------------------------------------------------------
-- 5. Crew actions (leader / commissioner)
-- ---------------------------------------------------------------------------
create or replace function public.crew_assert_can_remove(p_crew uuid, p_driver uuid)
returns void language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.is_crew_staff(p_crew) or public.is_moderator()) then
    raise exception 'not_allowed: only the crew leader or a commissioner can do this' using errcode = '42501';
  end if;
  if p_driver = public.current_driver_id() then
    raise exception 'not_self: use Leave crew instead' using errcode = 'P0001';
  end if;
  if public.is_crew_leader_of(p_crew, p_driver) and not public.is_moderator() then
    raise exception 'crew_leader_protected: only a moderator can remove a crew leader' using errcode = '42501';
  end if;
  if public.is_crew_commissioner_of(p_crew, p_driver) and not (public.is_crew_leader(p_crew) or public.is_moderator()) then
    raise exception 'commissioner_protected: only the crew leader can remove a commissioner' using errcode = '42501';
  end if;
end $$;

create or replace function public.kick_crew_member(p_crew uuid, p_driver uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.crew_assert_can_remove(p_crew, p_driver);
  delete from public.crew_memberships where crew_id = p_crew and driver_id = p_driver;
end $$;

create or replace function public.ban_crew_member(p_crew uuid, p_driver uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.crew_assert_can_remove(p_crew, p_driver);
  insert into public.crew_bans (crew_id, driver_id, banned_by)
  values (p_crew, p_driver, public.current_driver_id())
  on conflict do nothing;
  delete from public.crew_memberships where crew_id = p_crew and driver_id = p_driver;
end $$;

create or replace function public.unban_crew_member(p_crew uuid, p_driver uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.is_crew_staff(p_crew) or public.is_moderator()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.crew_bans where crew_id = p_crew and driver_id = p_driver;
end $$;

create or replace function public.list_crew_bans(p_crew uuid)
returns table(driver_id uuid, display_name text, banned_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not (public.is_crew_staff(p_crew) or public.is_moderator()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select b.driver_id, d.display_name, b.banned_at from public.crew_bans b
    join public.drivers d on d.driver_id = b.driver_id
    where b.crew_id = p_crew order by b.banned_at desc;
end $$;

create or replace function public.set_commissioner(p_crew uuid, p_driver uuid, p_on boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.is_crew_leader(p_crew) or public.is_moderator()) then
    raise exception 'not_allowed: only the crew leader can appoint commissioners' using errcode = '42501';
  end if;
  if p_on then
    if public.is_crew_leader_of(p_crew, p_driver) then
      raise exception 'already_leader' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.crew_memberships where crew_id = p_crew and driver_id = p_driver and status = 'active') then
      raise exception 'not_member: only active members can become commissioner' using errcode = 'P0001';
    end if;
    insert into public.hub_roles (driver_id, role, crew_id, granted_by)
    values (p_driver, 'crew_commissioner', p_crew, public.current_driver_id())
    on conflict do nothing;
  else
    delete from public.hub_roles where crew_id = p_crew and driver_id = p_driver and role = 'crew_commissioner';
  end if;
end $$;

-- Leader hands over to a commissioner and becomes commissioner (Fausto 19.10.).
-- A moderator may make any active member leader (inactive leader case).
create or replace function public.transfer_crew_leadership(p_crew uuid, p_driver uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare me uuid := public.current_driver_id(); old_leader uuid;
begin
  if not (public.is_crew_leader(p_crew) or public.is_moderator()) then
    raise exception 'not_allowed: only the crew leader can hand over the crew' using errcode = '42501';
  end if;
  if public.is_crew_leader_of(p_crew, p_driver) then
    raise exception 'already_leader' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.crew_memberships where crew_id = p_crew and driver_id = p_driver and status = 'active') then
    raise exception 'not_member: the new leader must be an active member' using errcode = 'P0001';
  end if;
  if not public.is_moderator() and not public.is_crew_commissioner_of(p_crew, p_driver) then
    raise exception 'not_commissioner: make this member a commissioner first' using errcode = 'P0001';
  end if;
  for old_leader in select driver_id from public.hub_roles where crew_id = p_crew and role = 'crew_leader' loop
    delete from public.hub_roles where crew_id = p_crew and driver_id = old_leader and role = 'crew_leader';
    if exists (select 1 from public.crew_memberships where crew_id = p_crew and driver_id = old_leader and status = 'active') then
      insert into public.hub_roles (driver_id, role, crew_id, granted_by)
      values (old_leader, 'crew_commissioner', p_crew, me) on conflict do nothing;
    end if;
  end loop;
  delete from public.hub_roles where crew_id = p_crew and driver_id = p_driver and role = 'crew_commissioner';
  insert into public.hub_roles (driver_id, role, crew_id, granted_by)
  values (p_driver, 'crew_leader', p_crew, me);
end $$;

-- Commissioner may change colour and join mode only (leader keeps direct update rights)
create or replace function public.set_crew_settings(p_crew uuid, p_color text default null, p_join_mode text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not (public.is_crew_staff(p_crew) or public.is_moderator()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.crews
     set color = coalesce(lower(p_color), color),
         join_mode = coalesce(p_join_mode, join_mode)
   where crew_id = p_crew;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Events: kick (this event) and ban (all events of this host)
-- ---------------------------------------------------------------------------
create table if not exists public.hub_event_kicks (
  event_id uuid not null references public.hub_events(event_id) on delete cascade,
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  kicked_by uuid references public.drivers(driver_id) on delete set null,
  kicked_at timestamptz not null default now(),
  primary key (event_id, driver_id)
);
create table if not exists public.hub_event_bans (
  host_driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  banned_at timestamptz not null default now(),
  primary key (host_driver_id, driver_id)
);
alter table public.hub_event_kicks enable row level security;
alter table public.hub_event_bans enable row level security;
create policy hub_event_kicks_select on public.hub_event_kicks for select
  using (public.is_moderator() or exists (select 1 from public.hub_events e where e.event_id = hub_event_kicks.event_id and e.created_by = public.current_driver_id()));
create policy hub_event_bans_select on public.hub_event_bans for select
  using (public.is_moderator() or host_driver_id = public.current_driver_id());
create index if not exists hub_event_kicks_driver_idx on public.hub_event_kicks (driver_id);
create index if not exists hub_event_bans_driver_idx on public.hub_event_bans (driver_id);

create or replace function public.hub_event_open_for_rsvp(p_event uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.hub_events e
    where e.event_id = p_event and e.is_published and e.status = 'scheduled'
      and e.registration = 'open'
      and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now()
      and (e.max_participants is null
           or (select count(*) from public.hub_event_rsvps r where r.event_id = e.event_id) < e.max_participants)
      and not exists (select 1 from public.hub_event_kicks k where k.event_id = e.event_id and k.driver_id = public.current_driver_id())
      and not exists (select 1 from public.hub_event_bans b where b.host_driver_id = e.created_by and b.driver_id = public.current_driver_id())
  );
$$;

-- Why can't I sign up? ('kicked' | 'banned' | null) -- for the RSVP button message
create or replace function public.my_event_block(p_event uuid)
returns text language sql stable security definer set search_path to 'public' as $$
  select case
    when exists (select 1 from public.hub_events e join public.hub_event_bans b on b.host_driver_id = e.created_by
                 where e.event_id = p_event and b.driver_id = public.current_driver_id()) then 'banned'
    when exists (select 1 from public.hub_event_kicks k where k.event_id = p_event and k.driver_id = public.current_driver_id()) then 'kicked'
  end;
$$;

create or replace function public.event_assert_host(p_event uuid, p_driver uuid)
returns uuid language plpgsql stable security definer set search_path to 'public' as $$
declare host uuid;
begin
  select created_by into host from public.hub_events where event_id = p_event;
  if not found then raise exception 'event_not_found' using errcode = 'P0001'; end if;
  if not (host = public.current_driver_id() or public.is_moderator()) then
    raise exception 'not_allowed: only the host can do this' using errcode = '42501';
  end if;
  if p_driver = host then raise exception 'not_self' using errcode = 'P0001'; end if;
  return host;
end $$;

create or replace function public.kick_event_participant(p_event uuid, p_driver uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.event_assert_host(p_event, p_driver);
  insert into public.hub_event_kicks (event_id, driver_id, kicked_by)
  values (p_event, p_driver, public.current_driver_id()) on conflict do nothing;
  delete from public.hub_event_rsvps where event_id = p_event and driver_id = p_driver;
end $$;

create or replace function public.unkick_event_participant(p_event uuid, p_driver uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.event_assert_host(p_event, p_driver);
  delete from public.hub_event_kicks where event_id = p_event and driver_id = p_driver;
end $$;

create or replace function public.ban_event_participant(p_event uuid, p_driver uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare host uuid;
begin
  host := public.event_assert_host(p_event, p_driver);
  insert into public.hub_event_bans (host_driver_id, driver_id) values (host, p_driver) on conflict do nothing;
  delete from public.hub_event_rsvps r
   using public.hub_events e
   where r.event_id = e.event_id and r.driver_id = p_driver and e.created_by = host
     and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now();
end $$;

create or replace function public.unban_event_participant(p_driver uuid, p_host uuid default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare host uuid := coalesce(p_host, public.current_driver_id());
begin
  if host is distinct from public.current_driver_id() and not public.is_moderator() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from public.hub_event_bans where host_driver_id = host and driver_id = p_driver;
end $$;

-- Host view: participants with ids (public_event_rsvps has names only)
create or replace function public.host_event_participants(p_event uuid)
returns table(driver_id uuid, display_name text, created_at timestamptz, kicked boolean)
language plpgsql stable security definer set search_path to 'public' as $$
declare host uuid;
begin
  select created_by into host from public.hub_events where event_id = p_event;
  if not (host = public.current_driver_id() or public.is_moderator()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select r.driver_id, case when d.deleted_at is null then d.display_name end, r.created_at, false from public.hub_event_rsvps r
      join public.drivers d on d.driver_id = r.driver_id where r.event_id = p_event
    union all
    select k.driver_id, case when d.deleted_at is null then d.display_name end, k.kicked_at, true from public.hub_event_kicks k
      join public.drivers d on d.driver_id = k.driver_id where k.event_id = p_event
    order by 4, 3;
end $$;

create or replace function public.my_event_bans()
returns table(driver_id uuid, display_name text, banned_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select b.driver_id, d.display_name, b.banned_at from public.hub_event_bans b
  join public.drivers d on d.driver_id = b.driver_id
  where b.host_driver_id = public.current_driver_id() order by b.banned_at desc;
$$;

-- ---------------------------------------------------------------------------
-- 7. Grants + start values
-- ---------------------------------------------------------------------------
revoke execute on function public.crew_assert_can_remove(uuid, uuid) from public, anon;
revoke execute on function public.event_assert_host(uuid, uuid) from public, anon;
revoke execute on function public.kick_crew_member(uuid, uuid), public.ban_crew_member(uuid, uuid),
  public.unban_crew_member(uuid, uuid), public.list_crew_bans(uuid), public.set_commissioner(uuid, uuid, boolean),
  public.transfer_crew_leadership(uuid, uuid), public.set_crew_settings(uuid, text, text),
  public.kick_event_participant(uuid, uuid), public.unkick_event_participant(uuid, uuid),
  public.ban_event_participant(uuid, uuid), public.unban_event_participant(uuid, uuid),
  public.host_event_participants(uuid), public.my_event_bans(), public.my_event_block(uuid) from anon;

-- All five house crews are open (Fausto 19.10.)
update public.crews set join_mode = 'open' where tag in ('LERA', 'GRAC', 'BCRW', 'LOWN', 'VCSR');
