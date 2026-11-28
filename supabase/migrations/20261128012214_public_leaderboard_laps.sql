-- Fausto 28.11.2026: leaderboard filters "Hide laps with nitrous" / "Hide track-limit violations".
-- The best lap per driver + car depends on the filter, so the browser needs every published lap
-- (not only the best one) with nitro_used and track_limits. Same columns and rules as public_leaderboard.
create or replace view public.public_leaderboard_laps as
select r.run_id,
    r.track_id,
    case when d.deleted_at is not null then 'Deleted driver'::text else d.display_name end as driver,
    v.vehicle_id,
    v.make,
    v.model,
    v.manufacturer_logo_slug,
    r.platform,
    r.lap_time_ms,
    r.verification_tier,
    (r.verification_tier = 'verified') as video_verified,
    (select ev.storage_reference from public.evidence ev
      where ev.run_id = r.run_id and ev.type = 'video_link' and ev.visibility = 'public' and ev.retention_state = 'active'
      order by ev.submitted_at desc limit 1) as video_url,
    (select count(*) from public.runs r2
      where r2.driver_id = r.driver_id and r2.track_id = r.track_id and r2.publication_status = any (array['provisional', 'official'])) as track_entries,
    r.nitro_used,
    r.track_limits,
    r.submitted_at,
    r.driver_id
from public.runs r
join public.drivers d on d.driver_id = r.driver_id
join public.vehicles v on v.vehicle_id = r.vehicle_id
where r.publication_status = any (array['provisional', 'official']);

revoke all on public.public_leaderboard_laps from anon, authenticated;
grant select on public.public_leaderboard_laps to anon, authenticated;
comment on view public.public_leaderboard_laps is 'Every published lap with nitro_used and track_limits; the leaderboard picks the best lap per driver + car after its filters (Fausto 28.11.2026).';
