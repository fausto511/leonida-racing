-- DEC-0234 (08.11.2026): new crew focus 'job-creation' (label "Job Creation").
alter table public.crews drop constraint crews_focus_check;
alter table public.crews add constraint crews_focus_check
  check (focus <@ array['racing','time-attack','league','drift','car-meet','cruise','job-creation']::text[]);

alter table public.hub_role_requests drop constraint hub_role_requests_new_crew_profile;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_profile
  check ((role <> 'crew_leader') or (status <> 'pending') or (crew_id is not null) or (
    (cardinality(new_crew_platforms) >= 1) and (new_crew_platforms <@ array['ps5','xbox']::text[])
    and (cardinality(new_crew_focus) >= 1)
    and (new_crew_focus <@ array['racing','time-attack','league','drift','car-meet','cruise','job-creation']::text[])
    and (cardinality(new_crew_languages) >= 1) and (cardinality(new_crew_languages) <= 2)
    and (new_crew_region = any (array['international','north-america','south-america','europe','middle-east','africa','asia','oceania']::text[]))));

alter table public.hub_role_requests drop constraint hub_role_requests_new_crew_profile_required;
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_profile_required
  check ((role <> 'crew_leader') or (status <> 'pending') or (crew_id is not null) or coalesce((
    (coalesce(cardinality(new_crew_platforms), 0) >= 1) and (new_crew_platforms <@ array['ps5','xbox']::text[])
    and (coalesce(cardinality(new_crew_focus), 0) >= 1)
    and (new_crew_focus <@ array['racing','time-attack','league','drift','car-meet','cruise','job-creation']::text[])
    and (coalesce(cardinality(new_crew_languages), 0) >= 1) and (coalesce(cardinality(new_crew_languages), 0) <= 2)
    and (new_crew_region = any (array['international','north-america','south-america','europe','middle-east','africa','asia','oceania']::text[]))), false));
