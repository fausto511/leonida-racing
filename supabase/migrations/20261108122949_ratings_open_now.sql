-- Car ratings open now instead of on launch day (Fausto 08.11.2026).
-- Website (vehicle.ts, compare-page.ts) mirrors this time for its hints only; the database decides.
create or replace function public.ratings_open()
 returns boolean
 language sql
 stable
 set search_path to 'public'
as $function$
  select now() >= timestamptz '2026-11-08 12:00:00+00';
$function$;
