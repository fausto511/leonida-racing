-- DEC-0100: /edit-event panel. Form now also sets the end time (empty = no end); buttons close / open
-- sign-ups and cancel the event. Both save as that driver, so the website rules apply.
drop function if exists public.discord_edit_event(text, uuid, text, timestamptz, text, integer);
create or replace function public.discord_edit_event(p_discord_id text, p_event uuid, p_title text, p_starts_at timestamptz, p_ends_at timestamptz, p_description text, p_max integer)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_driver uuid; v_auth uuid; e public.hub_events; res public.hub_events; v_pending jsonb;
begin
  select driver_id, auth_user_id into v_driver, v_auth from public.drivers where discord_user_id = p_discord_id and deleted_at is null;
  if v_driver is null or v_auth is null then return jsonb_build_object('status', 'no_profile'); end if;
  select * into e from public.hub_events where event_id = p_event;
  if not found or e.created_by is distinct from v_driver then return jsonb_build_object('status', 'not_found'); end if;
  if e.starts_at <= now() then return jsonb_build_object('status', 'started'); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_auth::text, true);
  begin
    update public.hub_events
       set title = btrim(p_title), starts_at = p_starts_at, ends_at = p_ends_at,
           description = nullif(btrim(coalesce(p_description, '')), ''), max_participants = p_max
     where event_id = p_event
    returning * into res;
  exception when others then
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    return jsonb_build_object('status', 'error', 'message', sqlerrm);
  end;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  select r.pending into v_pending from public.hub_event_reviews r where r.event_id = p_event;
  return jsonb_build_object('status', 'saved', 'review_status', res.review_status, 'pending', v_pending,
    'title', res.title, 'starts_at', res.starts_at, 'is_published', res.is_published);
end $$;
revoke all on function public.discord_edit_event(text, uuid, text, timestamptz, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.discord_edit_event(text, uuid, text, timestamptz, timestamptz, text, integer) to service_role;

create or replace function public.discord_event_action(p_discord_id text, p_event uuid, p_action text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_driver uuid; v_auth uuid; e public.hub_events; res public.hub_events;
begin
  if p_action not in ('close', 'open', 'cancel') then return jsonb_build_object('status', 'invalid'); end if;
  select driver_id, auth_user_id into v_driver, v_auth from public.drivers where discord_user_id = p_discord_id and deleted_at is null;
  if v_driver is null or v_auth is null then return jsonb_build_object('status', 'no_profile'); end if;
  select * into e from public.hub_events where event_id = p_event;
  if not found or e.created_by is distinct from v_driver then return jsonb_build_object('status', 'not_found'); end if;
  if e.starts_at <= now() then return jsonb_build_object('status', 'started'); end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_auth, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_auth::text, true);
  begin
    update public.hub_events
       set registration = case p_action when 'close' then 'closed' when 'open' then 'open' else registration end,
           status = case when p_action = 'cancel' then 'cancelled' else status end
     where event_id = p_event
    returning * into res;
  exception when others then
    perform set_config('request.jwt.claims', '', true);
    perform set_config('request.jwt.claim.sub', '', true);
    return jsonb_build_object('status', 'error', 'message', sqlerrm);
  end;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return jsonb_build_object('status', 'saved', 'registration', res.registration, 'event_status', res.status);
end $$;
revoke all on function public.discord_event_action(text, uuid, text) from public, anon, authenticated;
grant execute on function public.discord_event_action(text, uuid, text) to service_role;
