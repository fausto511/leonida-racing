-- Fausto 21.10.2026: invite search finds a name anywhere ("ann" finds "itsgianni"), prefix matches first. Applied via MCP.
create or replace function public.search_drivers_for_invite(p_crew uuid, p_query text)
returns table(driver_id uuid, display_name text)
language plpgsql stable security definer set search_path to 'public' as $fn$
declare q text := replace(replace(btrim(coalesce(p_query, '')), '%', ''), '_', '\_');
begin
  if not (public.is_crew_staff(p_crew) or public.is_moderator()) then raise exception 'not allowed'; end if;
  if char_length(q) < 3 then return; end if;
  return query
    select d.driver_id, d.display_name from public.drivers d
    where d.deleted_at is null and d.display_name is not null
      and d.display_name ilike '%' || q || '%'
      and not exists (select 1 from public.crew_memberships m where m.crew_id = p_crew and m.driver_id = d.driver_id)
      and not exists (select 1 from public.crew_bans b where b.crew_id = p_crew and b.driver_id = d.driver_id)
    order by (d.display_name ilike q || '%') desc, d.display_name
    limit 10;
end $fn$;
