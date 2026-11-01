-- RS-0099 / DEC-0206: Gellhorn record feed for the Discord bot.
-- A lap is posted when it sets a record (track overall, class or vehicle) on the
-- Gellhorn leaderboard, is video-verified (verification_tier 'verified') and beats an
-- existing time (the first time in a scope is never posted). Feed source 'gellhorn',
-- optionally limited to one crew (crew_id = only laps by active members of that crew).
-- If a posted lap stops counting (rejected, invalidated, hidden, deleted) the post goes;
-- name changes / account deletion re-render the post with the leaderboard name.

-- 1) feed source
alter table public.discord_feeds drop constraint discord_feeds_source_check;
alter table public.discord_feeds add constraint discord_feeds_source_check
  check (source = any (array['crew','host','public','vehicles','videos','gellhorn']));
alter table public.discord_feeds drop constraint discord_feeds_check;
alter table public.discord_feeds add constraint discord_feeds_check
  check ((source <> 'crew' or crew_id is not null) and (crew_id is null or source in ('crew','gellhorn')));

-- 2) outbox kinds 'record' (lap newly verified: post if it is a record) and
--    'record_sync' (only update / remove existing posts of that lap)
alter table public.discord_outbox add column run_id uuid;
alter table public.discord_outbox drop constraint discord_outbox_kind_check;
alter table public.discord_outbox add constraint discord_outbox_kind_check
  check (kind = any (array['event','backfill','vehicle','record','record_sync']));
alter table public.discord_outbox add constraint discord_outbox_record_check
  check ((kind in ('record','record_sync')) = (run_id is not null));

create or replace function public.discord_claim_outbox(p_limit integer default 50)
 returns setof public.discord_outbox language sql security definer set search_path to 'public' as $$
  update public.discord_outbox o set processed_at = now(), attempts = o.attempts + 1
   where o.id in (select id from public.discord_outbox
                   where processed_at is null and not_before <= now() and kind in ('event','backfill')
                   order by id limit p_limit for update skip locked)
  returning o.*;
$$;

-- All pending record rows at once as soon as one is due (so laps verified within a
-- couple of minutes end up in one summary post).
create or replace function public.discord_claim_records()
 returns setof public.discord_outbox language sql security definer set search_path to 'public' as $$
  update public.discord_outbox o set processed_at = now(), attempts = o.attempts + 1
   where o.id in (select id from public.discord_outbox
                   where processed_at is null and kind in ('record','record_sync')
                     and exists (select 1 from public.discord_outbox d where d.processed_at is null
                                  and d.kind in ('record','record_sync') and d.not_before <= now())
                   order by id limit 100 for update skip locked)
  returning o.*;
$$;

-- 3) posted record messages (one row per feed x lap; a summary post has several laps
--    with the same message_id). info = what the post says (records at posting time).
create table public.discord_record_posts (
  feed_id uuid not null references public.discord_feeds(feed_id) on delete cascade,
  run_id uuid not null,
  channel_id text not null,
  message_id text,
  info jsonb not null,
  created_at timestamptz not null default now(),
  primary key (feed_id, run_id)
);
create index discord_record_posts_run on public.discord_record_posts(run_id);
create index discord_record_posts_msg on public.discord_record_posts(feed_id, message_id);
alter table public.discord_record_posts enable row level security;
revoke all on public.discord_record_posts from anon, authenticated;

-- 4) record check. Returns null if the lap doesn't count (not Gellhorn, not public,
--    not verified) or holds no record that beats an existing time.
create or replace function public.gellhorn_run_records(p_run_id uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare
  r record; v record; recs jsonb := '[]'::jsonb; prev integer; c text; vid text;
begin
  select ru.*, d.display_name, d.deleted_at into r
    from public.runs ru join public.drivers d on d.driver_id = ru.driver_id
   where ru.run_id = p_run_id;
  if not found or r.track_id <> 'gellhorn-international-raceway'
     or r.publication_status not in ('provisional','official')
     or r.verification_tier <> 'verified' or r.review_status <> 'accepted' then
    return null;
  end if;
  select vehicle_id, make, model, coalesce(classes, '{}') as classes into v from public.vehicles where vehicle_id = r.vehicle_id;
  if not found then return null; end if;

  -- same set the website leaderboard shows: public laps on this track, every driver
  select min(o.lap_time_ms) into prev from public.runs o join public.vehicles ov on ov.vehicle_id = o.vehicle_id
   where o.track_id = r.track_id and o.run_id <> r.run_id and o.publication_status in ('provisional','official');
  if prev is not null and r.lap_time_ms < prev then
    recs := recs || jsonb_build_object('scope','overall','key','','prev_ms',prev);
  end if;
  foreach c in array v.classes loop
    select min(o.lap_time_ms) into prev from public.runs o join public.vehicles ov on ov.vehicle_id = o.vehicle_id
     where o.track_id = r.track_id and o.run_id <> r.run_id and o.publication_status in ('provisional','official')
       and c = any(ov.classes);
    if prev is not null and r.lap_time_ms < prev then
      recs := recs || jsonb_build_object('scope','class','key',c,'prev_ms',prev);
    end if;
  end loop;
  select min(o.lap_time_ms) into prev from public.runs o
   where o.track_id = r.track_id and o.run_id <> r.run_id and o.publication_status in ('provisional','official')
     and o.vehicle_id = r.vehicle_id;
  if prev is not null and r.lap_time_ms < prev then
    recs := recs || jsonb_build_object('scope','vehicle','key',r.vehicle_id,'prev_ms',prev);
  end if;
  if jsonb_array_length(recs) = 0 then return null; end if;

  select ev.storage_reference into vid from public.evidence ev
   where ev.run_id = r.run_id and ev.type = 'video_link' and ev.visibility = 'public' and ev.retention_state = 'active'
   order by ev.submitted_at desc limit 1;
  return jsonb_build_object('run_id', r.run_id, 'driver_id', r.driver_id, 'vehicle_id', v.vehicle_id,
    'make', v.make, 'model', v.model, 'platform', r.platform, 'lap_time_ms', r.lap_time_ms,
    'video_url', vid, 'records', recs);
end $$;

-- Does the lap (still) count on the leaderboard? Used to keep or remove posts.
create or replace function public.gellhorn_run_counts(p_run_id uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.runs ru where ru.run_id = p_run_id
     and ru.track_id = 'gellhorn-international-raceway' and ru.publication_status in ('provisional','official')
     and ru.verification_tier = 'verified' and ru.review_status = 'accepted');
$$;

-- Name as on the website leaderboard (deleted / anonymised accounts stay anonymous).
create or replace function public.gellhorn_driver_names(p_run_ids uuid[])
 returns table (run_id uuid, driver text) language sql stable security definer set search_path to 'public' as $$
  select ru.run_id, case when d.deleted_at is not null then 'Deleted driver' else d.display_name end
    from public.runs ru join public.drivers d on d.driver_id = ru.driver_id where ru.run_id = any(p_run_ids);
$$;

-- Gellhorn feeds that should get this lap: all-records feeds, plus crew feeds of a crew
-- the driver is an active member of (checked when posting).
create or replace function public.gellhorn_record_feeds(p_run_id uuid)
 returns setof public.discord_feeds language sql stable security definer set search_path to 'public' as $$
  select f.* from public.discord_feeds f
   where f.source = 'gellhorn'
     and (f.crew_id is null or exists (
       select 1 from public.runs ru join public.crew_memberships m on m.driver_id = ru.driver_id
        where ru.run_id = p_run_id and m.crew_id = f.crew_id and m.status = 'active'));
$$;

revoke all on function public.discord_claim_records(), public.gellhorn_run_records(uuid), public.gellhorn_run_counts(uuid),
  public.gellhorn_driver_names(uuid[]), public.gellhorn_record_feeds(uuid) from public, anon, authenticated;
grant execute on function public.discord_claim_records(), public.gellhorn_run_records(uuid), public.gellhorn_run_counts(uuid),
  public.gellhorn_driver_names(uuid[]), public.gellhorn_record_feeds(uuid) to service_role;

-- 5) triggers
create or replace function public.discord_enqueue_record(p_kind text, p_run uuid, p_delay interval)
 returns void language sql security definer set search_path to 'public' as $$
  insert into public.discord_outbox (kind, run_id, not_before)
  select p_kind, p_run, now() + p_delay
   where not exists (select 1 from public.discord_outbox where kind = p_kind and run_id = p_run and processed_at is null);
$$;
revoke all on function public.discord_enqueue_record(text, uuid, interval) from public, anon, authenticated;

create or replace function public.runs_gellhorn_record()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
declare
  was boolean := false; now_ boolean := false;
begin
  if tg_op <> 'INSERT' then
    was := old.track_id = 'gellhorn-international-raceway' and old.publication_status in ('provisional','official')
           and old.verification_tier = 'verified' and old.review_status = 'accepted';
  end if;
  if tg_op <> 'DELETE' then
    now_ := new.track_id = 'gellhorn-international-raceway' and new.publication_status in ('provisional','official')
            and new.verification_tier = 'verified' and new.review_status = 'accepted';
  end if;
  -- newly counting as a verified lap: post if it is a record (re-checked when posting)
  if now_ and not was and exists (select 1 from public.discord_feeds where source = 'gellhorn') then
    perform public.discord_enqueue_record('record', new.run_id, interval '2 minutes');
  end if;
  -- lap changed after posting: update or remove its posts
  if exists (select 1 from public.discord_record_posts p where p.run_id = coalesce(new.run_id, old.run_id))
     and (was is distinct from now_ or (tg_op = 'UPDATE' and (new.lap_time_ms, new.vehicle_id, new.platform) is distinct from (old.lap_time_ms, old.vehicle_id, old.platform))) then
    perform public.discord_enqueue_record('record_sync', coalesce(new.run_id, old.run_id), interval '0');
  end if;
  return null;
end $$;

create trigger runs_gellhorn_record
  after insert or delete or update of publication_status, verification_tier, review_status, lap_time_ms, vehicle_id, platform, track_id
  on public.runs for each row execute function public.runs_gellhorn_record();

create or replace function public.drivers_gellhorn_record()
 returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if (new.display_name, new.deleted_at) is distinct from (old.display_name, old.deleted_at) then
    perform public.discord_enqueue_record('record_sync', p.run_id, interval '0')
       from (select distinct p.run_id from public.discord_record_posts p join public.runs ru on ru.run_id = p.run_id
              where ru.driver_id = new.driver_id) p;
  end if;
  return null;
end $$;

create trigger drivers_gellhorn_record
  after update of display_name, deleted_at on public.drivers
  for each row execute function public.drivers_gellhorn_record();

revoke all on function public.runs_gellhorn_record(), public.drivers_gellhorn_record() from public, anon, authenticated;
