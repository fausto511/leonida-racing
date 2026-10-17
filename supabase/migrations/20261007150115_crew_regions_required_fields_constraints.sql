alter table public.crews add constraint crews_region_valid check (
  region in ('international','north-america','south-america','europe','middle-east','africa','asia','oceania'));
alter table public.crews add constraint crews_platforms_min1 check (cardinality(platforms) >= 1);
alter table public.crews add constraint crews_focus_min1 check (cardinality(focus) >= 1);
alter table public.crews add constraint crews_languages_min1 check (cardinality(languages) >= 1);
alter table public.hub_role_requests add constraint hub_role_requests_new_crew_profile check (
  role <> 'crew_leader' or status <> 'pending' or crew_id is not null or (
        cardinality(new_crew_platforms) >= 1 and new_crew_platforms <@ array['ps5','xbox']
    and cardinality(new_crew_focus) >= 1 and new_crew_focus <@ array['racing','time-attack','league','drift','car-meet','cruise']
    and cardinality(new_crew_languages) between 1 and 2
    and new_crew_region in ('international','north-america','south-america','europe','middle-east','africa','asia','oceania')));
