-- RS-0091 (Fausto 30.10.2026): the moderator alert in Discord said "Lap time submitted" also
-- when a driver sent a correction. A run coming back from needs_correction now reads
-- "Lap time corrected" and names what changed. Rest of the function unchanged.
CREATE OR REPLACE FUNCTION public.discord_mod_alert_enqueue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_kind text; v_actor_id uuid; v_detail text; v_link text; v_name text;
  v_fmt text; v_prev jsonb; v_changes text[];
begin
  begin
    if TG_TABLE_NAME = 'runs' then
      if NEW.review_status <> 'submitted' or (TG_OP = 'UPDATE' and OLD.review_status = 'submitted') then return NEW; end if;
      v_actor_id := NEW.driver_id; v_link := 'moderator/';
      v_detail := NEW.track_id || ' · ' || (NEW.lap_time_ms / 60000) || ':' || lpad(((NEW.lap_time_ms % 60000) / 1000)::text, 2, '0') || '.' || lpad((NEW.lap_time_ms % 1000)::text, 3, '0');
      if TG_OP = 'UPDATE' and OLD.review_status = 'needs_correction' then
        v_kind := 'Lap time corrected';
        v_prev := NEW.correction_prev;
        v_changes := array[]::text[];
        if v_prev ? 'vehicle_id' and (v_prev->>'vehicle_id') is distinct from NEW.vehicle_id then
          v_changes := v_changes || ('car was ' || coalesce(v_prev->>'vehicle_label', v_prev->>'vehicle_id'));
        end if;
        if v_prev ? 'lap_time_ms' and (v_prev->>'lap_time_ms')::int is distinct from NEW.lap_time_ms then
          v_fmt := ((v_prev->>'lap_time_ms')::int / 60000) || ':' || lpad((((v_prev->>'lap_time_ms')::int % 60000) / 1000)::text, 2, '0') || '.' || lpad(((v_prev->>'lap_time_ms')::int % 1000)::text, 3, '0');
          v_changes := v_changes || ('time was ' || v_fmt);
        end if;
        if coalesce((v_prev->>'new_screenshot')::boolean, false) then
          v_changes := v_changes || 'new screenshot'::text;
        end if;
        v_detail := v_detail || ' · ' || case when array_length(v_changes, 1) > 0 then array_to_string(v_changes, ', ') else 'nothing changed' end;
      else
        v_kind := 'Lap time submitted';
      end if;
    elsif TG_TABLE_NAME = 'hub_role_requests' then
      if NEW.status <> 'pending' then return NEW; end if;
      v_kind := 'Role request: ' || case NEW.role when 'crew_leader' then 'Crew Leader' when 'event_host' then 'Event Host' when 'creator' then 'Creator' else NEW.role end;
      v_actor_id := NEW.driver_id; v_link := 'moderator/hub/';
      v_detail := case when NEW.new_crew_name is not null then 'new crew ' || NEW.new_crew_name || ' [' || coalesce(NEW.new_crew_tag, '') || ']' end;
    elsif TG_TABLE_NAME = 'run_reports' then
      v_kind := 'Lap time reported'; v_actor_id := NEW.reporter_driver_id; v_link := 'moderator/reports/'; v_detail := NEW.reason;
    elsif TG_TABLE_NAME = 'content_reports' then
      v_kind := 'Content reported (' || NEW.target_type || ')'; v_actor_id := NEW.reporter_driver_id; v_link := 'moderator/content/'; v_detail := NEW.reason;
    elsif TG_TABLE_NAME = 'community_tracks' then
      if NEW.is_published then return NEW; end if;
      v_kind := 'Track submitted'; v_actor_id := NEW.created_by; v_link := 'moderator/hub/'; v_detail := left(NEW.title, 80);
    else
      return NEW;
    end if;
    select display_name into v_name from public.drivers where driver_id = v_actor_id;
    insert into public.discord_mod_alerts (kind, actor, detail, link) values (v_kind, v_name, v_detail, v_link);
  exception when others then
    -- never block the user's action because of a notification
    raise warning 'discord_mod_alert_enqueue: %', sqlerrm;
  end;
  return NEW;
end;
$function$;
