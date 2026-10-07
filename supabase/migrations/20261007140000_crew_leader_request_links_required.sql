-- Fausto 07.10.2026: a crew-leader request needs the crew's Discord invite or its Social Club crew page.
-- Applied via MCP. approve_hub_role_request also copies the Social Club link into the new crew.
alter table public.hub_role_requests add column if not exists new_crew_social_club_url text
  check (new_crew_social_club_url is null or (new_crew_social_club_url ~ '^https://socialclub\.rockstargames\.com/' and char_length(new_crew_social_club_url) <= 200));
alter table public.hub_role_requests add constraint hub_role_requests_leader_links
  check (role <> 'crew_leader' or status <> 'pending' or new_crew_discord_url is not null or new_crew_social_club_url is not null);
-- create or replace function public.approve_hub_role_request(...): as before, plus social_club_url in the crews insert.
