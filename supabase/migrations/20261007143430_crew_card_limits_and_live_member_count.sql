-- Fausto 07.10.2026: uniform crew cards.
-- Name max 24 characters (one line), description max 90 characters (two lines) without links,
-- at most 2 languages. NOT VALID: existing rows are only checked when they are edited.
alter table public.crews add constraint crews_name_max24 check (char_length(btrim(name)) <= 24) not valid;
alter table public.crews add constraint crews_description_max90 check (description is null or char_length(description) <= 90) not valid;
alter table public.crews add constraint crews_description_no_links check (description is null or description !~* '(https?://|www\.|discord\.(gg|com)/)') not valid;
alter table public.crews add constraint crews_languages_max2 check (cardinality(languages) <= 2) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_name_max24 check (new_crew_name is null or char_length(btrim(new_crew_name)) <= 24) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_description_max90 check (new_crew_description is null or char_length(new_crew_description) <= 90) not valid;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_description_no_links check (new_crew_description is null or new_crew_description !~* '(https?://|www\.|discord\.(gg|com)/)') not valid;

-- Member count = active members on Leonida Racing (no longer typed in by hand).
create or replace function public.crew_member_count(p_crew uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.crew_memberships where crew_id = p_crew and status = 'active';
$$;
create or replace function public.crews_set_member_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.member_count := case when tg_op = 'INSERT' then 0 else public.crew_member_count(new.crew_id) end;
  return new;
end $$;
create trigger crews_member_count before insert or update on public.crews
  for each row execute function public.crews_set_member_count();
-- Refresh the crew's count; a crew whose old data no longer meets the new limits
-- (e.g. a long description) keeps its old count until it is edited, instead of
-- blocking joins and leaves.
create or replace function public.crew_refresh_count(p_crew uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.crews set member_count = 0 where crew_id = p_crew;
exception when check_violation then null;
end $$;
create or replace function public.crew_memberships_refresh_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then perform public.crew_refresh_count(new.crew_id); end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.crew_id <> new.crew_id) then perform public.crew_refresh_count(old.crew_id); end if;
  return null;
end $$;
create trigger crew_memberships_refresh_count after insert or update of status, crew_id or delete on public.crew_memberships
  for each row execute function public.crew_memberships_refresh_count();
revoke all on function public.crew_refresh_count(uuid) from public, anon, authenticated;
select public.crew_refresh_count(crew_id) from public.crews;
