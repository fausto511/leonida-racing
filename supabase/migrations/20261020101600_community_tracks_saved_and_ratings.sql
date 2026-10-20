-- DEC-0146 (Fausto 20.10.2026): saved tracks (one list per driver) + track ratings (like vehicle ratings,
-- without the launch-date gate; creators cannot rate their own track).

create table public.saved_tracks (
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  track_id uuid not null references public.community_tracks(track_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (driver_id, track_id)
);
alter table public.saved_tracks enable row level security;
create policy saved_tracks_select_own on public.saved_tracks for select using (driver_id = public.current_driver_id());
create policy saved_tracks_insert_own on public.saved_tracks for insert with check (
  driver_id = public.current_driver_id()
  and exists (select 1 from public.community_tracks t where t.track_id = saved_tracks.track_id and t.is_published)
);
create policy saved_tracks_delete_own on public.saved_tracks for delete using (driver_id = public.current_driver_id());
revoke all on public.saved_tracks from anon;
grant select, insert, delete on public.saved_tracks to authenticated;

create table public.track_ratings (
  driver_id uuid not null references public.drivers(driver_id) on delete cascade,
  track_id uuid not null references public.community_tracks(track_id) on delete cascade,
  stars smallint not null check (stars >= 1 and stars <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (driver_id, track_id)
);
alter table public.track_ratings enable row level security;
create policy track_ratings_select_own on public.track_ratings for select using (driver_id = public.current_driver_id());
create policy track_ratings_moderator_read on public.track_ratings for select using (public.is_moderator());
create policy track_ratings_insert_own on public.track_ratings for insert with check (
  driver_id = public.current_driver_id()
  and exists (select 1 from public.community_tracks t where t.track_id = track_ratings.track_id and t.is_published and t.created_by <> track_ratings.driver_id)
);
create policy track_ratings_update_own on public.track_ratings for update using (driver_id = public.current_driver_id()) with check (
  driver_id = public.current_driver_id()
  and exists (select 1 from public.community_tracks t where t.track_id = track_ratings.track_id and t.is_published and t.created_by <> track_ratings.driver_id)
);
create policy track_ratings_delete_own on public.track_ratings for delete using (driver_id = public.current_driver_id());
revoke all on public.track_ratings from anon;
grant select, insert, update, delete on public.track_ratings to authenticated;

-- Public average, only from 3 ratings (same rule as public_vehicle_ratings).
create view public.public_track_ratings as
  select r.track_id, round(avg(r.stars), 1) as rating_avg, (count(*))::integer as rating_count
  from public.track_ratings r
  join public.drivers d on d.driver_id = r.driver_id and d.deleted_at is null
  group by r.track_id
  having count(*) >= 3;
grant select on public.public_track_ratings to anon, authenticated;

create or replace function public.moderator_remove_track_rating(p_driver uuid, p_track uuid, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_old public.track_ratings;
begin
  if not public.is_moderator() then raise exception 'not allowed'; end if;
  delete from public.track_ratings where driver_id = p_driver and track_id = p_track returning * into v_old;
  if v_old is null then return false; end if;
  insert into public.moderation_log (moderator_driver_id, action, previous_value, reason)
  values (public.current_driver_id(), 'track_rating_removed',
          jsonb_build_object('driver_id', v_old.driver_id, 'track_id', v_old.track_id, 'stars', v_old.stars, 'updated_at', v_old.updated_at),
          p_reason);
  return true;
end $function$;
revoke all on function public.moderator_remove_track_rating(uuid, uuid, text) from public, anon;
grant execute on function public.moderator_remove_track_rating(uuid, uuid, text) to authenticated;
