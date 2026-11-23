-- Specialist "Hot Rods" seen in the game ('55 Bobcat 500, Fausto 23.11.2026).
alter table public.vehicles drop constraint vehicles_specialist_check;
alter table public.vehicles
  add constraint vehicles_specialist_check check (specialist is null or specialist = any (array['Luxury','Tuner','Off-Road','Muscle','Donks','Lowriders','Hot Rods','None']));
update public.vehicles set specialist = 'Hot Rods' where vehicle_id = 'declasse-bobcat-500-55';
