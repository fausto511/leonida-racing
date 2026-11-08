-- DEC-0235 addendum (08.11.2026): 0 = checked, under 50 SC members (stored, never shown).
alter table public.crews drop constraint crews_sc_member_range_check;
alter table public.crews add constraint crews_sc_member_range_check
  check (sc_member_range in (0, 50, 100, 250, 500, 750));
comment on column public.crews.sc_member_range is 'Lower bound of the Social Club member range (50+/100+/250+/500+/750+); 0 = checked, under 50, not shown. Moderators only. DEC-0235.';
