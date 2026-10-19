-- Weekly cleanup of the pg_cron run log (Fausto 19.10.2026, applied by Fausto in the SQL editor).
-- discord-dispatch runs every minute -> ~1.5 MB log per day; keep 7 days.
select cron.schedule(
  'cleanup-cron-log-weekly',
  '41 3 * * 0',
  'delete from cron.job_run_details where end_time < now() - interval ''7 days'''
);
delete from cron.job_run_details where end_time < now() - interval '7 days';
