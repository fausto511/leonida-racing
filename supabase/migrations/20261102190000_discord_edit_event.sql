-- DEC-0100 / RS-0097: /edit-event in Discord. The bot (service role) saves the host's changes
-- as that driver (request.jwt claims set for this call only), so the same triggers and rules
-- apply as on the website (host stages DEC-0209, contact, emoji, launch date). If the start
-- moves, an end time moves with it. Only the event's own host can edit it.
create or replace function public.discord_edit_event(p_discord_id text, p_event uuid, p_title text, p_starts_at timestamptz, p_description text, p_max integer)
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
       set title = btrim(p_title),
           starts_at = p_starts_at,
           ends_at = case when ends_at is not null then ends_at + (p_starts_at - starts_at) end,
           description = nullif(btrim(coalesce(p_description, '')), ''),
           max_participants = p_max
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
revoke all on function public.discord_edit_event(text, uuid, text, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.discord_edit_event(text, uuid, text, timestamptz, text, integer) to service_role;
