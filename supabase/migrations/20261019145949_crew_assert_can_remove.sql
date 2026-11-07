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

