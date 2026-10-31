-- Fausto 31.10.2026: no emojis in any text a user can write (crews, crew requests, events,
-- tracks, reports, profile). Checked on INSERT and whenever the field changes, so old rows
-- with an emoji (e.g. a Discord display name) don't block edits of other fields.
-- Argument "@col": only checked for signed-in users (display_name is first copied from Discord
-- by the server; a user can't add an emoji when renaming).
-- Moderator-only notes and system copies (content_reports.target_text/target_snapshot) are not checked.

create or replace function public.has_emoji(t text) returns boolean
  language sql immutable set search_path = public
as $$ select coalesce(t ~ '[⌚⌛⏩-⏺☀-➿⬀-⯿️‍⃣\U0001F000-\U0001FAFF]', false) $$;

create or replace function public.reject_emoji() returns trigger
  language plpgsql set search_path = public
as $fn$
declare
  a text; col text; v_new jsonb := to_jsonb(new); v_old jsonb;
begin
  if tg_op = 'UPDATE' then v_old := to_jsonb(old); end if;
  foreach a in array tg_argv loop
    col := ltrim(a, '@');
    if left(a, 1) = '@' and auth.uid() is null then continue; end if;
    if v_old is not null and (v_new->>col) is not distinct from (v_old->>col) then continue; end if;
    if public.has_emoji(v_new->>col) then
      raise exception 'no_emoji: emojis are not allowed (%)', col using errcode = '22023';
    end if;
  end loop;
  return new;
end $fn$;
revoke execute on function public.reject_emoji() from public, anon, authenticated;

create or replace trigger crews_reject_emoji before insert or update on public.crews
  for each row execute function public.reject_emoji('name', 'description');
create or replace trigger hub_role_requests_reject_emoji before insert or update on public.hub_role_requests
  for each row execute function public.reject_emoji('new_crew_name', 'new_crew_description', 'message');
create or replace trigger hub_events_reject_emoji before insert or update on public.hub_events
  for each row execute function public.reject_emoji('title', 'host_name', 'location', 'description');
create or replace trigger community_tracks_reject_emoji before insert or update on public.community_tracks
  for each row execute function public.reject_emoji('title');
create or replace trigger content_reports_reject_emoji before insert or update on public.content_reports
  for each row execute function public.reject_emoji('reason', 'details');
create or replace trigger run_reports_reject_emoji before insert or update on public.run_reports
  for each row execute function public.reject_emoji('reason', 'details');
create or replace trigger drivers_reject_emoji before insert or update on public.drivers
  for each row execute function public.reject_emoji('@display_name', 'psn_name');
create or replace trigger video_channels_reject_emoji before insert or update on public.video_channels
  for each row execute function public.reject_emoji('input');
