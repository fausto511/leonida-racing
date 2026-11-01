-- DEC-0204 correction (Fausto 01.11.2026): when an event loses its crew, the profile PSN is NOT
-- copied in (the host decides whether their PSN is shown). No PSN and no own Discord left ->
-- back to draft; the host adds a contact themselves.
create or replace function public.events_drop_crew(p_crew uuid, p_driver uuid)
returns void language plpgsql security definer set search_path = public as $$
declare crew_code text; prev text := current_setting('lr.event_sync', true);
begin
  perform set_config('lr.event_sync', 'on', true);
  select public.discord_invite_code(discord_url) into crew_code from public.crews where crew_id = p_crew;
  with c as (
    select e.event_id, e.created_by, e.host_name,
           case when crew_code is not null and public.discord_invite_code(e.discord_url) = crew_code
                then null else e.discord_url end as new_discord
      from public.hub_events e
     where e.host_crew_id = p_crew and e.starts_at > now()
       and (p_driver is null or e.created_by = p_driver)
  )
  update public.hub_events e
     set host_crew_id = null,
         discord_url = c.new_discord,
         is_published = case when c.new_discord is null and c.host_name is null then false else e.is_published end,
         host_notice = case when c.created_by is null then null
                            when c.new_discord is null and c.host_name is null then 'crew_removed_hidden'
                            else 'crew_removed' end,
         host_notice_at = now()
    from c
   where e.event_id = c.event_id;
  perform set_config('lr.event_sync', coalesce(prev, ''), true);
end $$;

revoke all on function public.events_drop_crew(uuid, uuid) from public, anon, authenticated;
