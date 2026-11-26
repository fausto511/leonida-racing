-- DEC-0258 (Fausto 26.11.2026): pickups show 2 extra seats when the bed is empty.
-- seats = with an empty bed (higher number), seats_cab = cab only. Set only when both were seen in game.
alter table public.vehicles add column if not exists seats_cab smallint check (seats_cab is null or seats_cab > 0);
comment on column public.vehicles.seats_cab is 'Pickups: seats in the cab only (panel with a loaded bed). seats = with an empty bed (+2). Only set when both numbers were seen in game (DEC-0258).';
update public.vehicles set seats_cab = seats - 2 where vehicle_id in ('bravado-bison-900','declasse-bobcat-xl-84','declasse-rancher-86','declasse-yosemite-1500','bravado-bison-1800','canis-kamacho','karin-contender','vapid-montagne-pickup');
