-- Applied 21.10.2026 by Fausto in the SQL editor (Codex privacy review 20.10.).
-- 1) anonymize_driver_account also removes crew/event restrictions of the deleted account
--    and clears banned_by / kicked_by where the deleted account applied them.
-- 2) Daily job: event kicks are deleted 7 days after the event ended (Fausto 21.10.).
-- Full function text: see the live definition (pg_get_functiondef('public.anonymize_driver_account')).
-- Added lines inside the function:
--   delete from public.crew_bans       where driver_id = p_driver;
--   update public.crew_bans       set banned_by = null where banned_by = p_driver;
--   delete from public.hub_event_kicks where driver_id = p_driver;
--   update public.hub_event_kicks set kicked_by = null where kicked_by = p_driver;
--   delete from public.hub_event_bans  where driver_id = p_driver or host_driver_id = p_driver;
select cron.schedule(
  'cleanup-event-kicks-daily',
  '53 3 * * *',
  'delete from public.hub_event_kicks k using public.hub_events e where k.event_id = e.event_id and coalesce(e.ends_at, e.starts_at + interval ''3 hours'') < now() - interval ''7 days'''
);
