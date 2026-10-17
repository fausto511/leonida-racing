alter table public.crews add column if not exists is_official boolean not null default false;
alter table public.hub_role_requests
  add column if not exists new_crew_platforms text[],
  add column if not exists new_crew_focus text[],
  add column if not exists new_crew_languages text[],
  add column if not exists new_crew_region text;
