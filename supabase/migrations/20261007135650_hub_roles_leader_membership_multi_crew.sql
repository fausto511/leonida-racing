-- Fix (07.10.2026): since RS-0062 a driver can be in up to 5 crews; the unique key is
-- (driver_id, crew_id), not driver_id. A new crew leader becomes an active member of
-- that crew; an existing pending/invited membership in the same crew is activated.
create or replace function public.hub_roles_leader_membership()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.role = 'crew_leader' and new.crew_id is not null then
    insert into public.crew_memberships (crew_id, driver_id, status, decided_at, decided_by)
    values (new.crew_id, new.driver_id, 'active', now(), new.granted_by)
    on conflict (driver_id, crew_id) do update
      set status = 'active', decided_at = excluded.decided_at, decided_by = excluded.decided_by
      where public.crew_memberships.status <> 'active';
  end if;
  return new;
end;
$function$;
