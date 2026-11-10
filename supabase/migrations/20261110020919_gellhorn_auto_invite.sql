-- Fausto 10.11.2026: new drivers get one crew invite from Gellhorn Racing, 1-24 h after sign-up
-- (spread per driver). Only drivers who signed up after
-- active_since. Never a second automatic invite (crew_auto_invites). Gellhorn Racing has no
-- 20-open-invites limit. Config and log are private (RLS on, no policies).
-- Applied via MCP (DEC-0133). Switch off: update public.crew_auto_invite_config set enabled = false;

create table if not exists public.crew_auto_invite_config (
  crew_id uuid primary key references public.crews(crew_id) on delete cascade,
  invited_by uuid not null references public.drivers(driver_id),
  active_since timestamptz not null default now(),
  enabled boolean not null default true,
  unlimited_invites boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.crew_auto_invite_config enable row level security;
revoke all on public.crew_auto_invite_config from anon, authenticated;

create table if not exists public.crew_auto_invites (
  crew_id uuid not null references public.crews(crew_id) on delete cascade,
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  invited_at timestamptz not null default now(),
  result text not null default 'invited',
  primary key (crew_id, driver_id)
);
alter table public.crew_auto_invites enable row level security;
revoke all on public.crew_auto_invites from anon, authenticated;

insert into public.crew_auto_invite_config (crew_id, invited_by)
select c.crew_id, '0da0d0b7-4f60-4850-81b1-46a599200594'::uuid from public.crews c where c.name = 'Gellhorn Racing'
on conflict (crew_id) do nothing;

-- Limit trigger: unchanged except the 20-open-invites check is skipped for crews with unlimited_invites
create or replace function public.crew_memberships_limit()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status = 'invited' then
    if not exists (select 1 from public.crew_auto_invite_config k where k.crew_id = new.crew_id and k.unlimited_invites)
       and (select count(*) from public.crew_memberships m where m.crew_id = new.crew_id and m.status = 'invited') >= 20 then
      raise exception 'invite_limit: a crew can have at most 20 open invites' using errcode = 'P0001';
    end if;
    -- Fausto 21.10.2026: a driver can hold at most 10 open invites at once
    if (select count(*) from public.crew_memberships m where m.driver_id = new.driver_id and m.status = 'invited') >= 10 then
      raise exception 'driver_invite_limit: this driver already has 10 open crew invites' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.crew_invite_declines x where x.crew_id = new.crew_id and x.driver_id = new.driver_id and x.declined_at > now() - interval '30 days') then
      raise exception 'invite_declined: this driver declined an invite from this crew in the last 30 days' using errcode = 'P0001';
    end if;
  elsif (select count(*) from public.crew_memberships m where m.driver_id = new.driver_id and m.status in ('pending', 'active')) >= 5 then
    raise exception 'crew_limit: a driver can be in at most 5 crews (including open requests)' using errcode = 'P0001';
  end if;
  return new;
end $function$;

create or replace function public.run_crew_auto_invites()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare k record; d record; n integer := 0;
begin
  for k in select * from public.crew_auto_invite_config where enabled loop
    for d in
      select dr.driver_id from public.drivers dr
      where dr.deleted_at is null and dr.display_name is not null
        and dr.created_at >= k.active_since
        and dr.created_at + make_interval(mins => 60 + abs(hashtext(dr.driver_id::text)) % 1381) <= now()
        and dr.driver_id <> k.invited_by
        and not exists (select 1 from public.crew_auto_invites a where a.crew_id = k.crew_id and a.driver_id = dr.driver_id)
      limit 200
    loop
      begin
        if exists (select 1 from public.crew_memberships m where m.crew_id = k.crew_id and m.driver_id = d.driver_id)
           or exists (select 1 from public.crew_invite_declines x where x.crew_id = k.crew_id and x.driver_id = d.driver_id) then
          insert into public.crew_auto_invites (crew_id, driver_id, result) values (k.crew_id, d.driver_id, 'skipped_existing');
        else
          insert into public.crew_memberships (crew_id, driver_id, status, invited_by)
          values (k.crew_id, d.driver_id, 'invited', k.invited_by);
          insert into public.crew_auto_invites (crew_id, driver_id, result) values (k.crew_id, d.driver_id, 'invited');
          n := n + 1;
        end if;
      exception when others then
        insert into public.crew_auto_invites (crew_id, driver_id, result)
        values (k.crew_id, d.driver_id, 'skipped: ' || left(sqlerrm, 80))
        on conflict (crew_id, driver_id) do nothing;
      end;
    end loop;
  end loop;
  return n;
end $$;
revoke all on function public.run_crew_auto_invites() from public, anon, authenticated;

select cron.schedule('crew-auto-invites', '7,22,37,52 * * * *', $$select public.run_crew_auto_invites();$$);
