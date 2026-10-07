-- Fausto 07.10.2026: uniform crew cards. Applied via MCP (two migrations).
-- Name max 22 (one line; a first 24 limit was too long), description max 90 without links,
-- at most 2 languages. NOT VALID: existing rows are only checked when edited.
alter table public.crews add constraint crews_name_max24 check (char_length(btrim(name)) <= 24) not valid;
alter table public.crews add constraint crews_name_max22 check (char_length(btrim(name)) <= 22) not valid;
alter table public.crews add constraint crews_description_max90 check (description is null or char_length(description) <= 90) not valid;
alter table public.crews add constraint crews_description_no_links check (description is null or description !~* '(https?://|www\.|discord\.(gg|com)/)') not valid;
alter table public.crews add constraint crews_languages_max2 check (cardinality(languages) <= 2) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_name_max24 check (new_crew_name is null or char_length(btrim(new_crew_name)) <= 24) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_name_max22 check (new_crew_name is null or char_length(btrim(new_crew_name)) <= 22) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_description_max90 check (new_crew_description is null or char_length(new_crew_description) <= 90) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_description_no_links check (new_crew_description is null or new_crew_description !~* '(https?://|www\.|discord\.(gg|com)/)') not valid;
-- Member count = active members (triggers crews_member_count, crew_memberships_refresh_count;
-- functions crew_member_count, crews_set_member_count, crew_refresh_count, crew_memberships_refresh_count).
