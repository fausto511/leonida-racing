-- Notification dot at the avatar (Fausto 14.11.2026; replaces the dropped Discord DMs, DEC-0208).
-- One call, my_notices(), returns per account area what needs action ("to fix") and what is
-- new since the driver last opened that area ("new"). mark_notices_seen(area) is called by the
-- area's page. Nothing is sent anywhere; it only drives the dot, menu labels and tab counts.

create table if not exists public.driver_notice_seen (
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  area text not null check (area in ('laps', 'crews', 'events', 'tracks', 'settings')),
  seen_at timestamptz not null default now(),
  primary key (driver_id, area)
);
alter table public.driver_notice_seen enable row level security;
-- no policies: only the two security-definer functions below read and write it

-- When did a lap get its moderator decision? (updated_at also moves on the driver's own changes)
alter table public.runs add column if not exists status_changed_at timestamptz;
create or replace function public.runs_status_changed_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.review_status is distinct from old.review_status or new.publication_status is distinct from old.publication_status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists runs_status_changed_at on public.runs;
create trigger runs_status_changed_at before update of review_status, publication_status on public.runs
  for each row execute function public.runs_status_changed_at();

-- When did a community track get published? (updated_at also moves on the creator's own edits)
alter table public.community_tracks add column if not exists published_at timestamptz;
create or replace function public.community_tracks_published_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.is_published and not coalesce(old.is_published, false) then new.published_at := now(); end if;
  return new;
end $$;
drop trigger if exists community_tracks_published_at on public.community_tracks;
create trigger community_tracks_published_at before update of is_published on public.community_tracks
  for each row execute function public.community_tracks_published_at();
update public.community_tracks set published_at = updated_at where is_published and published_at is null;

create or replace function public.my_notices() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := public.current_driver_id();
  s_laps timestamptz; s_crews timestamptz; s_events timestamptz; s_tracks timestamptz; s_settings timestamptz;
  r jsonb;
begin
  if me is null then return null; end if;
  -- first call: start from now, so old decisions never show up as "new"
  insert into public.driver_notice_seen (driver_id, area)
    select me, a from unnest(array['laps', 'crews', 'events', 'tracks', 'settings']) a
    on conflict do nothing;
  select max(seen_at) filter (where area = 'laps'), max(seen_at) filter (where area = 'crews'),
         max(seen_at) filter (where area = 'events'), max(seen_at) filter (where area = 'tracks'),
         max(seen_at) filter (where area = 'settings')
    into s_laps, s_crews, s_events, s_tracks, s_settings
    from public.driver_notice_seen where driver_id = me;

  r := jsonb_build_object(
    'laps', jsonb_build_object(
      'fix', (select count(*) from public.runs where driver_id = me and review_status = 'needs_correction'),
      'new', (select count(*) from public.runs where driver_id = me and status_changed_at > s_laps
                and review_status in ('accepted', 'rejected', 'invalidated'))),
    'crews', jsonb_build_object(
      'fix', (select count(*) from public.crew_memberships where driver_id = me and status = 'invited')
           + (select count(*) from public.crew_memberships m where m.status = 'pending' and m.driver_id <> me
                and exists (select 1 from public.hub_roles h where h.driver_id = me and h.crew_id = m.crew_id and h.role in ('crew_leader', 'crew_commissioner'))),
      'new', (select count(*) from public.crew_memberships where driver_id = me and status = 'active'
                and decided_at > s_crews and decided_by is distinct from me)
           + (select count(*) from public.hub_role_requests where driver_id = me and role in ('crew_leader', 'crew_commissioner')
                and status in ('approved', 'rejected') and decided_at > s_crews)),
    'events', jsonb_build_object(
      -- a series counts once, not once per round
      'fix', (select count(distinct coalesce(e.series_id, e.event_id)) from public.hub_events e where e.created_by = me
                and coalesce(e.ends_at, e.starts_at) > now()
                and (e.host_notice is not null or e.review_status in ('needs_changes', 'rejected'))),
      'new', (select count(distinct coalesce(e.series_id, e.event_id)) from public.hub_events e join public.hub_event_reviews v on v.event_id = e.event_id
                where e.created_by = me and e.review_status = 'approved' and v.reviewed_at > s_events
                  and v.reviewed_by is distinct from me)
           + (select count(*) from public.hub_role_requests where driver_id = me and role = 'event_host'
                and status in ('approved', 'rejected') and decided_at > s_events)),
    'tracks', jsonb_build_object(
      'fix', (select count(*) from public.community_tracks where created_by = me and not is_published and review_note is not null),
      'new', (select count(*) from public.community_tracks where created_by = me and is_published and published_at > s_tracks)),
    'settings', jsonb_build_object(
      'fix', 0,
      'new', (select count(*) from public.hub_role_requests where driver_id = me
                and role not in ('crew_leader', 'crew_commissioner', 'event_host')
                and status in ('approved', 'rejected') and decided_at > s_settings))
  );
  return r;
end $$;

create or replace function public.mark_notices_seen(p_area text) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := public.current_driver_id();
begin
  if me is null or p_area not in ('laps', 'crews', 'events', 'tracks', 'settings') then return; end if;
  insert into public.driver_notice_seen (driver_id, area, seen_at) values (me, p_area, now())
    on conflict (driver_id, area) do update set seen_at = excluded.seen_at;
end $$;

revoke all on function public.my_notices() from public, anon;
revoke all on function public.mark_notices_seen(text) from public, anon;
grant execute on function public.my_notices() to authenticated;
grant execute on function public.mark_notices_seen(text) to authenticated;
