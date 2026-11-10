-- Fausto 10.11.2026: daily page views / visits from Cloudflare Web Analytics (only visitors who
-- allowed visitor statistics, privacy policy section 12) for the moderator area. Aggregated
-- figures only. Filled by the edge function site-visits-sync (pg_cron, job token).
-- Applied via MCP (DEC-0133).
create table if not exists public.site_daily_visits (
  day date primary key,
  pageviews int not null default 0,
  visits int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.site_daily_visits enable row level security;
revoke all on public.site_daily_visits from anon, authenticated;

insert into private.job_tokens (name, token)
values ('site-visits-sync', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict do nothing;

create or replace function public.mod_site_visits(p_days int default 60)
returns table (day date, pageviews int, visits int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_moderator() then raise exception 'not_moderator'; end if;
  return query select v.day, v.pageviews, v.visits from public.site_daily_visits v
    where v.day >= current_date - greatest(1, least(p_days, 400)) order by v.day;
end $$;
revoke all on function public.mod_site_visits(int) from public, anon;
grant execute on function public.mod_site_visits(int) to authenticated;

select cron.schedule('site-visits-sync', '41 * * * *', $$
  select net.http_post(
    url := 'https://pprzkexqltudeuqjnsqa.supabase.co/functions/v1/site-visits-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-job-token', (select token from private.job_tokens where name = 'site-visits-sync')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000);
$$);
