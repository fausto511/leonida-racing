-- DEC-0216 fix: verifying the real crew must stay possible even if a copy with the same name
-- already exists (moderators handle the copy). Only names of crews that ARE verified are blocked.
create or replace function public.crews_verified_name_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from public.crews c
     where c.crew_id <> new.crew_id
       and c.is_verified
       and lower(btrim(c.name)) = lower(btrim(new.name))
  ) then
    raise exception 'A verified crew already uses this name. Please choose a different crew name.'
      using errcode = '23505';
  end if;
  return new;
end $function$;
