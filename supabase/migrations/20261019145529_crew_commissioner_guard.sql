set local lock_timeout = '15s';
create or replace function public.crew_memberships_commissioner_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if old.status = 'active'
     and auth.uid() is not null
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

