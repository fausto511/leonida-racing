-- DEC-0235 (08.11.2026): Social Club crew size as a range, set by moderators only.
alter table public.crews add column sc_member_range smallint
  check (sc_member_range in (50, 100, 250, 500, 750));
comment on column public.crews.sc_member_range is 'Lower bound of the Social Club member range (50+/100+/250+/500+/750+). Moderators only. DEC-0235.';

create or replace function public.crews_protect_featured()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not public.is_moderator() then
    if tg_op = 'INSERT' then
      new.is_featured := false;
      new.is_official := false;
      new.is_launch_crew := false;
      new.is_verified := false;
      new.sc_member_range := null;
    else
      new.is_featured := old.is_featured;
      new.is_official := old.is_official;
      new.is_launch_crew := old.is_launch_crew;
      new.is_verified := old.is_verified;
      new.sc_member_range := old.sc_member_range;
    end if;
  end if;
  return new;
end $function$;
