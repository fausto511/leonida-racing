-- RS-0067 package 4: "I'm in" / "Withdraw" from Discord. Same rules as the
-- website (hub_event_open_for_rsvp); only the discord-interactions edge
-- function (service role) may call it. Serialised per event so the last free
-- seat can't be taken twice.
create or replace function public.discord_rsvp(p_event uuid, p_discord_id text, p_going boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_driver uuid;
  v_e record;
  v_status text;
  v_count int;
begin
  select driver_id into v_driver from drivers where discord_user_id = p_discord_id and deleted_at is null;
  if v_driver is null then return jsonb_build_object('status', 'no_profile'); end if;

  perform pg_advisory_xact_lock(hashtextextended('rsvp:' || p_event::text, 0));
  select e.*, c.discord_url as crew_discord_url into v_e
    from hub_events e left join crews c on c.crew_id = e.host_crew_id
   where e.event_id = p_event;
  if not found or not v_e.is_published then return jsonb_build_object('status', 'not_found'); end if;

  if p_going then
    if exists (select 1 from hub_event_rsvps where event_id = p_event and driver_id = v_driver) then
      v_status := 'already';
    elsif public.hub_event_open_for_rsvp(p_event) then
      insert into hub_event_rsvps (event_id, driver_id) values (p_event, v_driver);
      v_status := 'in';
    elsif v_e.status = 'cancelled' then v_status := 'cancelled';
    elsif coalesce(v_e.ends_at, v_e.starts_at + interval '3 hours') <= now() then v_status := 'past';
    elsif v_e.registration <> 'open' then v_status := 'closed';
    else v_status := 'full';
    end if;
  else
    delete from hub_event_rsvps where event_id = p_event and driver_id = v_driver;
    v_status := case when found then 'out' else 'not_in' end;
  end if;

  select count(*) into v_count from hub_event_rsvps where event_id = p_event;
  return jsonb_build_object(
    'status', v_status, 'going', v_count, 'max', v_e.max_participants,
    'title', v_e.title, 'host_name', v_e.host_name,
    'discord_url', coalesce(v_e.discord_url, v_e.crew_discord_url));
end $$;
revoke all on function public.discord_rsvp(uuid, text, boolean) from public, anon, authenticated;
