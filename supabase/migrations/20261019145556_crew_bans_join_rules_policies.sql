set local lock_timeout = '15s';
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

create or replace function public.crew_staff(p_crew uuid)
returns table(driver_id uuid, role text)
language sql stable security definer set search_path to 'public' as $$
  select r.driver_id, r.role from public.hub_roles r
  join public.crews c on c.crew_id = r.crew_id
  where r.crew_id = p_crew and r.role in ('crew_leader', 'crew_commissioner')
    and (c.is_published or public.is_crew_staff(p_crew) or public.is_moderator());
$$;

