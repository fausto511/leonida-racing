-- DEC-0201 (Fausto 31.10.2026): "Launch Crew" badge for crews listed by the end of the weekend
-- after GTA VI launch week. Same look and weight as "Official". Not for crews marked Official;
-- Rockford Club counts as external here (Fausto 31.10.).
-- Cut-off: request received by Sun 29.11.2026 23:59:59 US Eastern (EST, UTC-5). Request time counts, not approval.
-- Set automatically when a moderator approves the crew request; kept for good; only moderators can change it.

alter table public.crews add column if not exists is_launch_crew boolean not null default false;

create or replace function public.launch_crew_cutoff() returns timestamptz
  language sql immutable set search_path = public
as $$ select timestamptz '2026-11-29 23:59:59-05' $$;

-- Crews already listed (before the cut-off) and not Official. Runs before the guard below,
-- which would otherwise keep the old value for a non-moderator session.
update public.crews set is_launch_crew = true
 where is_published and not coalesce(is_official, false) and created_at <= public.launch_crew_cutoff();

create or replace function public.crews_protect_featured() returns trigger
  language plpgsql security definer set search_path = public
as $function$
begin
  if not public.is_moderator() then
    if tg_op = 'INSERT' then
      new.is_featured := false;
      new.is_official := false;
      new.is_launch_crew := false;
    else
      new.is_featured := old.is_featured;
      new.is_official := old.is_official;
      new.is_launch_crew := old.is_launch_crew;
    end if;
  end if;
  return new;
end $function$;

create or replace function public.approve_hub_role_request(p_request_id uuid) returns uuid
  language plpgsql security definer set search_path = public
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
                              platforms, focus, languages, region, is_published, is_launch_crew)
    values (v_slug, btrim(r.new_crew_name), r.new_crew_tag, lower(r.new_crew_color), r.new_crew_discord_url,
            r.new_crew_social_club_url, r.new_crew_description,
            coalesce(r.new_crew_platforms, '{}'), coalesce(r.new_crew_focus, '{}'),
            coalesce(r.new_crew_languages, '{}'), r.new_crew_region, true,
            r.requested_at <= public.launch_crew_cutoff())  -- DEC-0201
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
