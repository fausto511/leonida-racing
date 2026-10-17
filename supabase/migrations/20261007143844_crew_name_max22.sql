-- 24 characters still overflowed the card at 1920 px; 22 is the longest name that fits (Fausto 07.10.2026).
alter table public.crews add constraint crews_name_max22 check (char_length(btrim(name)) <= 22) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_name_max22 check (new_crew_name is null or char_length(btrim(new_crew_name)) <= 22) not valid;
