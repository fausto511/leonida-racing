create or replace function public.crew_memberships_leader_cleanup()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.status = 'active' and (tg_op = 'DELETE' or new.status <> 'active') then
    delete from public.hub_roles
     where driver_id = old.driver_id and crew_id = old.crew_id and role in ('crew_leader', 'crew_commissioner');
  end if;
  return null;
end $$;

