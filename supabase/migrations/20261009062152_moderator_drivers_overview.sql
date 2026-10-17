-- Moderator > Drivers (Fausto 2026-10-09): key figures + paged search, scales to large user counts.
-- No e-mail, no Discord ID. Moderators only (checked inside, SECURITY DEFINER).

create index if not exists drivers_created_at_idx on public.drivers (created_at desc);

create or replace function public.moderator_driver_stats()
 returns json language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators' using errcode = '42501';
  end if;
  return json_build_object(
    'total',        (select count(*) from public.drivers where deleted_at is null),
    'new_7d',       (select count(*) from public.drivers where deleted_at is null and created_at > now() - interval '7 days'),
    'new_30d',      (select count(*) from public.drivers where deleted_at is null and created_at > now() - interval '30 days'),
    'deleted',      (select count(*) from public.drivers where deleted_at is not null),
    'crew_leaders', (select count(distinct driver_id) from public.hub_roles where role = 'crew_leader'),
    'event_hosts',  (select count(distinct driver_id) from public.hub_roles where role = 'event_host'),
    'creators',     (select count(distinct driver_id) from public.hub_roles where role = 'creator'),
    'moderators',   (select count(*) from public.moderators)
  );
end $function$;

create or replace function public.moderator_search_drivers(p_q text default null, p_limit int default 25, p_offset int default 0)
 returns table (driver_id uuid, display_name text, created_at timestamptz, roles text[], crews text[], is_moderator boolean, total_count bigint)
 language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators' using errcode = '42501';
  end if;
  return query
  with base as (
    select d.driver_id, d.display_name, d.created_at
      from public.drivers d
     where d.deleted_at is null
       and (coalesce(btrim(p_q), '') = '' or d.display_name ilike '%' || btrim(p_q) || '%')
  )
  select b.driver_id, b.display_name, b.created_at,
         coalesce((select array_agg(distinct h.role order by h.role) from public.hub_roles h where h.driver_id = b.driver_id), '{}'),
         coalesce((select array_agg(c.tag order by c.tag) from public.crew_memberships m join public.crews c on c.crew_id = m.crew_id
                    where m.driver_id = b.driver_id and m.status = 'active'), '{}'),
         exists (select 1 from public.moderators mo where mo.driver_id = b.driver_id),
         count(*) over ()
    from base b
   order by b.created_at desc
   limit least(greatest(coalesce(p_limit, 25), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $function$;

revoke all on function public.moderator_driver_stats() from public, anon;
revoke all on function public.moderator_search_drivers(text, int, int) from public, anon;
grant execute on function public.moderator_driver_stats() to authenticated;
grant execute on function public.moderator_search_drivers(text, int, int) to authenticated;
