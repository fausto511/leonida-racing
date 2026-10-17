-- Applied via the Supabase SQL editor on 2026-10-08 (not in the live migration history; RS-0075).
-- Part 1 (crew_memberships_leader_guard) is the live migration 20261008032612.
-- In Supabase SQL Editor einfügen und Run (Teil 1, der Guard, ist schon live).

create or replace function public.crew_memberships_leader_cleanup()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if old.status = 'active' and (tg_op = 'DELETE' or new.status <> 'active') then
    delete from public.hub_roles
     where driver_id = old.driver_id and crew_id = old.crew_id and role = 'crew_leader';
  end if;
  return null;
end $function$;

create trigger crew_memberships_leader_cleanup after delete or update of status on public.crew_memberships
  for each row execute function public.crew_memberships_leader_cleanup();

create or replace function public.delete_own_crew(p_crew uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare me uuid := public.current_driver_id();
begin
  if not (public.is_crew_leader(p_crew) or public.is_moderator()) then
    raise exception 'Only the crew leader can delete this crew' using errcode = '42501';
  end if;
  if exists (select 1 from public.crew_memberships m where m.crew_id = p_crew and m.status = 'active' and m.driver_id is distinct from me)
     or exists (select 1 from public.hub_roles h where h.crew_id = p_crew and h.role = 'crew_leader' and h.driver_id is distinct from me) then
    raise exception 'crew_has_members: remove all other members first' using errcode = 'P0001';
  end if;
  delete from public.crews where crew_id = p_crew;
end $function$;

revoke all on function public.delete_own_crew(uuid) from public, anon;
grant execute on function public.delete_own_crew(uuid) to authenticated;
