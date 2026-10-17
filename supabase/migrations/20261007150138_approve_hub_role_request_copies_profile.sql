create or replace function public.approve_hub_role_request(p_request_id uuid)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  r public.hub_role_requests;
  v_crew uuid;
  v_base text;
  v_slug text;
  n int := 1;
  v_mod uuid := public.current_driver_id();
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can approve requests' using errcode = '42501';
  end if;
  select * into r from public.hub_role_requests where request_id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request was already decided'; end if;

  v_crew := r.crew_id;
  if r.role = 'crew_leader' and v_crew is null then
    v_base := left(trim(both '-' from regexp_replace(lower(r.new_crew_name), '[^a-z0-9]+', '-', 'g')), 40);
    if v_base = '' then v_base := 'crew'; end if;
    v_slug := v_base;
    while exists (select 1 from public.crews where slug = v_slug) loop
      n := n + 1; v_slug := v_base || '-' || n;
    end loop;
    insert into public.crews (slug, name, tag, color, discord_url, social_club_url, description,
                              platforms, focus, languages, region, is_published)
    values (v_slug, btrim(r.new_crew_name), r.new_crew_tag, lower(r.new_crew_color), r.new_crew_discord_url,
            r.new_crew_social_club_url, r.new_crew_description,
            coalesce(r.new_crew_platforms, '{}'), coalesce(r.new_crew_focus, '{}'),
            coalesce(r.new_crew_languages, '{}'), r.new_crew_region, true)
    returning crew_id into v_crew;
  end if;

  if not exists (select 1 from public.hub_roles h where h.driver_id = r.driver_id and h.role = r.role
                 and h.crew_id is not distinct from (case when r.role = 'crew_leader' then v_crew end)) then
    insert into public.hub_roles (driver_id, role, crew_id, granted_by)
    values (r.driver_id, r.role, case when r.role = 'crew_leader' then v_crew end, v_mod);
  end if;

  update public.hub_role_requests
     set status = 'approved', decided_at = now(), decided_by = v_mod
   where request_id = p_request_id;
  return v_crew;
end;
$function$;
