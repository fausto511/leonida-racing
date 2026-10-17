alter table public.hub_role_requests add constraint hub_role_requests_new_crew_profile_required check (
  role <> 'crew_leader' or status <> 'pending' or crew_id is not null or coalesce(
        coalesce(cardinality(new_crew_platforms), 0) >= 1 and new_crew_platforms <@ array['ps5','xbox']
    and coalesce(cardinality(new_crew_focus), 0) >= 1 and new_crew_focus <@ array['racing','time-attack','league','drift','car-meet','cruise']
    and coalesce(cardinality(new_crew_languages), 0) between 1 and 2
    and new_crew_region in ('international','north-america','south-america','europe','middle-east','africa','asia','oceania'), false));
