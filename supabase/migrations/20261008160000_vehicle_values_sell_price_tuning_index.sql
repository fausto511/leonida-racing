-- Applied via the Supabase SQL editor on 2026-10-08, after 20261008152155 (not in the live migration history; RS-0075).
-- In Supabase SQL Editor einfügen und Run.
-- Verkaufspreis als neuer Messwert + Tuning-Stand im "ein aktueller Wert"-Index
-- (Spalte tuning und Trigger sind schon live).
alter table public.vehicle_values drop constraint vehicle_values_metric_check;
alter table public.vehicle_values add constraint vehicle_values_metric_check
  check (metric in ('price_gtad','sell_price_gtad','top_speed_mph','gellhorn_reference_lap_ms'));

drop index public.vehicle_values_one_current;
create unique index vehicle_values_one_current on public.vehicle_values (vehicle_id, metric, tuning) where status = 'current';
