-- Body condition per value (Fausto 23.11.2026, DEC-0248): the sell value of a stolen car depends on the
-- car's body condition (Top/Good/Average/Poor/Scrap in the WAiNK scanner). One current value per
-- vehicle + metric + tuning + condition, so a car can show its sell value per condition.
alter table public.vehicle_values add column if not exists condition text;
alter table public.vehicle_values add constraint vehicle_values_condition_check
  check (condition is null or condition = any (array['Top','Good','Average','Poor','Scrap']));
comment on column public.vehicle_values.condition is 'Body condition shown in the WAiNK scanner when the value was read (used for sell values). Null = not condition-dependent.';

drop index if exists public.vehicle_values_one_current;
create unique index vehicle_values_one_current on public.vehicle_values
  (vehicle_id, metric, tuning, coalesce(condition, '')) where (status = 'current');

create or replace function public.vehicle_values_supersede()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.status = 'current' then
    update public.vehicle_values set status = 'superseded'
    where vehicle_id = new.vehicle_id and metric = new.metric and tuning = new.tuning
      and condition is not distinct from new.condition
      and status = 'current' and value_id <> new.value_id;
  end if;
  return new;
end; $function$;
