set local lock_timeout = '15s';
alter table public.crews
  add column if not exists join_mode text not null default 'request'
  constraint crews_join_mode_check check (join_mode in ('open', 'request'));

alter table public.hub_roles drop constraint hub_roles_role_check;
alter table public.hub_roles add constraint hub_roles_role_check
  check (role = any (array['crew_leader', 'crew_commissioner', 'event_host', 'creator']));
alter table public.hub_roles drop constraint hub_roles_crew_matches_role;
alter table public.hub_roles add constraint hub_roles_crew_matches_role
  check ((role in ('crew_leader', 'crew_commissioner')) = (crew_id is not null));

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

