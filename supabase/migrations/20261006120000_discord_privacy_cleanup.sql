-- Discord bot privacy cleanup (06.10.2026, Codex privacy review, Fausto approved).
-- STATUS: the ALTER TABLE line is already applied (via MCP). The rest is still
-- open -> Fausto runs this whole file once in the Supabase SQL Editor (safe to
-- run again: drop not null / create or replace are idempotent; cron.schedule
-- with the same job name replaces the job).
-- 1) Account deletion also removes the stored Discord link of a feed creator.
-- 2) Feeds of a deleted host (personal host feed) are removed by the daily
--    housekeeping one day after the deletion; the host's events are deleted
--    immediately, so the dispatcher first removes their posts in Discord.
-- 3) Daily housekeeping: processed outbox rows older than 7 days are deleted,
--    independent of new events; the dispatcher additionally checks every feed
--    for deleted channels / removed bot (body {"housekeeping": true}).

alter table public.discord_feeds alter column created_by_discord_id drop not null;

create or replace function public.anonymize_driver_account(p_driver uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.drivers where driver_id = p_driver and deleted_at is null) then
    raise exception 'no active driver %', p_driver;
  end if;

  -- personal / social data
  delete from public.hub_event_rsvps     where driver_id = p_driver;
  delete from public.owned_vehicles      where driver_id = p_driver;
  delete from public.run_reports         where reporter_driver_id = p_driver;
  delete from public.content_reports     where reporter_driver_id = p_driver;
  delete from public.hub_events          where created_by = p_driver;   -- carry his PSN name
  delete from public.community_tracks    where created_by = p_driver;   -- carry his name as creator
  delete from public.hub_role_requests   where driver_id = p_driver;
  delete from public.hub_roles           where driver_id = p_driver;
  delete from public.crew_memberships    where driver_id = p_driver;
  delete from public.crew_membership_history where driver_id = p_driver;
  delete from public.moderators          where driver_id = p_driver;

  -- Discord feeds he set up: crew / public feeds keep running for the server,
  -- without any link to him. His personal host feed: see discord_housekeeping().
  update public.discord_feeds
     set created_by_discord_id = null, created_by_driver_id = null
   where created_by_driver_id = p_driver
      or created_by_discord_id = (select discord_user_id from public.drivers where driver_id = p_driver);

  -- submissions nobody can review any more (no evidence left)
  delete from public.runs
   where driver_id = p_driver
     and review_status in ('draft', 'submitted', 'under_review', 'needs_correction');

  -- evidence of the remaining (reviewed) times
  update public.evidence e set storage_reference = null, retention_state = 'deleted', delete_after = now()
    from public.runs r
   where r.run_id = e.run_id and r.driver_id = p_driver and e.type = 'screenshot';
  delete from public.evidence e using public.runs r
   where r.run_id = e.run_id and r.driver_id = p_driver and e.type = 'video_link';

  -- the driver row: no name, no Discord, no login link
  update public.drivers
     set display_name = 'Deleted driver', discord_user_id = null, auth_user_id = null,
         deleted_at = now()
   where driver_id = p_driver;
  delete from public.driver_name_history where driver_id = p_driver;  -- incl. the row the rename just logged
end $function$;

create or replace function public.discord_housekeeping() returns void
language sql security definer set search_path = public as $$
  delete from public.discord_outbox where processed_at < now() - interval '7 days';
  delete from public.discord_feeds f using public.drivers d
   where f.source = 'host' and f.host_driver_id = d.driver_id
     and d.deleted_at is not null and d.deleted_at < now() - interval '1 day';
$$;
revoke all on function public.discord_housekeeping() from public, anon, authenticated;

select cron.schedule('discord-housekeeping', '23 3 * * *', $cron$
  select public.discord_housekeeping();
  select net.http_post(
    url := 'https://pprzkexqltudeuqjnsqa.supabase.co/functions/v1/discord-dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-job-token', (select token from private.job_tokens where name = 'discord-dispatch')),
    body := '{"housekeeping": true}'::jsonb,
    timeout_milliseconds := 55000);
$cron$);
