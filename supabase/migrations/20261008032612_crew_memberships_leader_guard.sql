create or replace function public.crew_memberships_leader_guard()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if old.status = 'active'
     and old.driver_id is distinct from public.current_driver_id()
     and not public.is_moderator()
     and exists (select 1 from public.hub_roles h where h.driver_id = old.driver_id and h.crew_id = old.crew_id and h.role = 'crew_leader')
  then
    raise exception 'crew_leader_protected: only a moderator can remove a crew leader' using errcode = '42501';
  end if;
  return old;
end $function$;

create trigger crew_memberships_leader_guard before delete on public.crew_memberships
  for each row execute function public.crew_memberships_leader_guard();
