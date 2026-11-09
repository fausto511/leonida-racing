-- Moderator overview (RS-0102 stage 1, Fausto 09.11.2026): to-do counts + site stats.
-- Totals only, no lists of people. Readable only by moderators (is_moderator()).

-- 1) One row per day (Berlin time) with site totals, so "active drivers per day" gets a history.
create table if not exists public.site_daily_stats (
  day date primary key,
  active_users int not null default 0,
  accounts int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.site_daily_stats enable row level security;
-- no policies: only security definer functions below read or write it
revoke all on public.site_daily_stats from anon, authenticated;

create or replace function public.snapshot_site_daily_stats()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_day date := (now() at time zone 'Europe/Berlin')::date;
  v_start timestamptz := (v_day::timestamp at time zone 'Europe/Berlin');
begin
  insert into public.site_daily_stats (day, active_users, accounts, updated_at)
  values (
    v_day,
    (select count(distinct user_id) from auth.refresh_tokens where updated_at >= v_start),
    (select count(*) from auth.users),
    now())
  on conflict (day) do update
    set active_users = greatest(public.site_daily_stats.active_users, excluded.active_users),
        accounts = excluded.accounts,
        updated_at = now();
end;
$$;
revoke all on function public.snapshot_site_daily_stats() from public, anon, authenticated;

-- hourly, so the last run of a day catches everyone who was active that day
select cron.unschedule('site-daily-stats-hourly') where exists (select 1 from cron.job where jobname = 'site-daily-stats-hourly');
select cron.schedule('site-daily-stats-hourly', '29 * * * *', $$select public.snapshot_site_daily_stats()$$);
select public.snapshot_site_daily_stats();

-- 2) Everything the overview page shows, in one call.
create or replace function public.mod_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_start timestamptz := (v_today::timestamp at time zone 'Europe/Berlin');
  r jsonb;
begin
  if not public.is_moderator() then
    raise exception 'not_moderator' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'todo', jsonb_build_object(
      'laps_review', (select count(*) from runs where review_status in ('submitted', 'under_review')),
      'videos_check', (select count(*) from runs where review_status = 'accepted' and verification_tier = 'video_submitted'),
      'events_review', (select count(*) from hub_events where review_status = 'pending' and series_id is null)
                     + (select count(*) from hub_event_series where status = 'active' and review_status = 'pending'),
      'event_changes', (select count(*) from hub_event_reviews where pending is not null)
                     + (select count(*) from hub_event_series where status = 'active' and review_status = 'approved' and pending is not null),
      'requests', (select count(*) from hub_role_requests where status = 'pending'),
      'tracks', (select count(*) from community_tracks where is_published = false),
      'time_reports', (select count(*) from run_reports where status = 'open'),
      'content_reports', (select count(*) from content_reports where status = 'open')
    ),
    'users', jsonb_build_object(
      'accounts', (select count(*) from auth.users),
      'new_today', (select count(*) from auth.users where created_at >= v_start),
      'active_1', (select count(distinct user_id) from auth.refresh_tokens where updated_at >= v_start),
      'active_7', (select count(distinct user_id) from auth.refresh_tokens where updated_at > now() - interval '7 days'),
      'active_30', (select count(distinct user_id) from auth.refresh_tokens where updated_at > now() - interval '30 days'),
      'accounts_before', (select count(*) from auth.users where created_at < v_start - interval '29 days'),
      'new_per_day', (
        select jsonb_agg(jsonb_build_object('day', d::date, 'n', coalesce(n, 0)) order by d)
        from generate_series(v_today - 29, v_today, interval '1 day') d
        left join (select (created_at at time zone 'Europe/Berlin')::date as dd, count(*) as n from auth.users group by 1) u on u.dd = d::date),
      'active_per_day', (
        select coalesce(jsonb_agg(jsonb_build_object('day', day, 'n', active_users) order by day), '[]'::jsonb)
        from site_daily_stats where day > v_today - 30)
    ),
    'laps', jsonb_build_object(
      'total', (select count(*) from runs where review_status <> 'draft'),
      'in_review', (select count(*) from runs where review_status in ('submitted', 'under_review')),
      'needs_correction', (select count(*) from runs where review_status = 'needs_correction'),
      'accepted', (select count(*) from runs where review_status = 'accepted' and verification_tier <> 'verified'),
      'verified', (select count(*) from runs where verification_tier = 'verified'),
      'rejected', (select count(*) from runs where review_status in ('rejected', 'invalidated'))
    ),
    'cars', jsonb_build_object(
      'ratings', (select count(*) from vehicle_ratings),
      'rating_drivers', (select count(distinct driver_id) from vehicle_ratings),
      'stars', (select jsonb_object_agg(s, coalesce(n, 0)) from generate_series(1, 5) s
                left join (select stars, count(*) as n from vehicle_ratings group by stars) x on x.stars = s),
      'owned', (select count(*) from owned_vehicles),
      'wishlist', (select count(*) from wishlist_vehicles)
    ),
    'community', jsonb_build_object(
      'crews', (select count(*) from crews where is_published),
      'events_upcoming', (select count(*) from hub_events where is_published and starts_at > now() and status <> 'cancelled'),
      'signups', (select count(*) from hub_event_rsvps r join hub_events e on e.event_id = r.event_id where e.starts_at > now()),
      'feeds', (select count(*) from discord_feeds),
      'feeds_by_source', (select coalesce(jsonb_object_agg(source, n), '{}'::jsonb) from (select source, count(*) as n from discord_feeds group by source) f)
    ),
    'at', now()
  ) into r;
  return r;
end;
$$;
revoke all on function public.mod_overview() from public, anon;
grant execute on function public.mod_overview() to authenticated;
