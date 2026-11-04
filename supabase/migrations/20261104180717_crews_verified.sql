-- DEC-0216 (Fausto 04.11.2026): moderators mark a crew as verified = confirmed as the original
-- crew (e.g. the real crew of a well-known creator). Shown with the same white rosette as ICON.
alter table public.crews add column is_verified boolean not null default false;
comment on column public.crews.is_verified is 'Verified crew (DEC-0216): confirmed as the original by a moderator. Only moderators can set it.';

-- Only moderators can set or clear it (same guard as is_featured / is_official).
create or replace function public.crews_protect_featured()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_moderator() then
    if tg_op = 'INSERT' then
      new.is_featured := false;
      new.is_official := false;
      new.is_launch_crew := false;
      new.is_verified := false;
    else
      new.is_featured := old.is_featured;
      new.is_official := old.is_official;
      new.is_launch_crew := old.is_launch_crew;
      new.is_verified := old.is_verified;
    end if;
  end if;
  return new;
end $function$;

-- No other crew may use exactly the name of a verified crew (case and outer spaces ignored).
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
       and lower(btrim(c.name)) = lower(btrim(new.name))
       and (c.is_verified or new.is_verified)
  ) then
    raise exception 'A verified crew already uses this name. Please choose a different crew name.'
      using errcode = '23505';
  end if;
  return new;
end $function$;

create trigger crews_verified_name_guard
  before insert or update of name, is_verified on public.crews
  for each row execute function public.crews_verified_name_guard();
