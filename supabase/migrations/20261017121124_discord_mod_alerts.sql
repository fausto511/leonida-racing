-- Mod alerts (DEC-0137 point 7, Fausto 17.10.2026): everything that waits for a moderator on the
-- website gets a short notice in the private #mod-alerts channel. Only kind + display name + link.
-- Service role only (discord-dispatch); RLS on without policies on purpose.
create table public.discord_mod_alerts (
  id bigint generated always as identity primary key,
  kind text not null,
  actor text,
  detail text,
  link text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  attempts int not null default 0
);
alter table public.discord_mod_alerts enable row level security;
create index discord_mod_alerts_pending_idx on public.discord_mod_alerts (id) where sent_at is null;

create or replace function public.discord_mod_alerts_pending() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.discord_mod_alerts where sent_at is null and attempts < 20);
$$;
revoke all on function public.discord_mod_alerts_pending() from public, anon, authenticated;

create or replace function public.discord_mod_alert_enqueue() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind text; v_actor_id uuid; v_detail text; v_link text; v_name text;
begin
  begin
    if TG_TABLE_NAME = 'runs' then
      if NEW.review_status <> 'submitted' or (TG_OP = 'UPDATE' and OLD.review_status = 'submitted') then return NEW; end if;
      v_kind := 'Lap time submitted'; v_actor_id := NEW.driver_id; v_link := 'moderator/';
      v_detail := NEW.track_id || ' · ' || (NEW.lap_time_ms / 60000) || ':' || lpad(((NEW.lap_time_ms % 60000) / 1000)::text, 2, '0') || '.' || lpad((NEW.lap_time_ms % 1000)::text, 3, '0');
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
$$;
revoke all on function public.discord_mod_alert_enqueue() from public, anon, authenticated;

create trigger runs_mod_alert after insert or update of review_status on public.runs
  for each row execute function public.discord_mod_alert_enqueue();
create trigger hub_role_requests_mod_alert after insert on public.hub_role_requests
  for each row execute function public.discord_mod_alert_enqueue();
create trigger run_reports_mod_alert after insert on public.run_reports
  for each row execute function public.discord_mod_alert_enqueue();
create trigger content_reports_mod_alert after insert on public.content_reports
  for each row execute function public.discord_mod_alert_enqueue();
create trigger community_tracks_mod_alert after insert on public.community_tracks
  for each row execute function public.discord_mod_alert_enqueue();

-- dispatch cron: also run when alerts wait
select cron.alter_job((select jobid from cron.job where jobname = 'discord-dispatch'), command := $cmd$
  select net.http_post(
    url := 'https://pprzkexqltudeuqjnsqa.supabase.co/functions/v1/discord-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-job-token', (select token from private.job_tokens where name = 'discord-dispatch')),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000)
  where exists (select 1 from public.discord_outbox where processed_at is null and not_before <= now())
     or exists (select 1 from public.discord_role_jobs where processed_at is null and not_before <= now())
     or public.discord_reminders_pending()
     or public.discord_lfg_pending()
     or public.discord_mod_alerts_pending();
$cmd$);
