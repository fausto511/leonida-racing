alter table public.crews alter column region set not null;

create or replace function public.crews_protect_featured()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_moderator() then
    if tg_op = 'INSERT' then
      new.is_featured := false;
      new.is_official := false;
    else
      new.is_featured := old.is_featured;
      new.is_official := old.is_official;
    end if;
  end if;
  return new;
end $function$;

create or replace function public.crew_member_count(p_crew uuid)
 returns integer language sql stable security definer set search_path to 'public'
as $function$
  select count(*)::int from (
    select driver_id from public.crew_memberships where crew_id = p_crew and status = 'active'
    union
    select driver_id from public.hub_roles where crew_id = p_crew and role = 'crew_leader'
  ) x;
$function$;

create or replace function public.hub_roles_refresh_count()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if tg_op in ('INSERT','UPDATE') and new.crew_id is not null then perform public.crew_refresh_count(new.crew_id); end if;
  if tg_op in ('DELETE','UPDATE') and old.crew_id is not null then perform public.crew_refresh_count(old.crew_id); end if;
  return null;
end $function$;

create trigger hub_roles_refresh_count after insert or delete or update of crew_id, role on public.hub_roles
  for each row execute function public.hub_roles_refresh_count();
