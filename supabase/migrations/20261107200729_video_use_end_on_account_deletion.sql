-- DEC-0210 (Fausto 07.11.2026): consent to use lap videos lasts until the driver turns it off
-- or the lap is deleted. Deleting the account counts as turning it off: every lap that still
-- has consent is switched off and logged (the log stays with the anonymized lap as proof).
create or replace function public.drivers_end_video_use_on_delete()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    insert into public.video_use_log (run_id, allowed)
      select r.run_id, false from public.runs r
       where r.driver_id = new.driver_id and r.video_use_ok;
    update public.runs
       set video_use_ok = false, video_use_until = now()
     where driver_id = new.driver_id and video_use_ok;
  end if;
  return null;
end $$;
revoke execute on function public.drivers_end_video_use_on_delete() from public, anon, authenticated;

create or replace trigger drivers_end_video_use_on_delete
  after update of deleted_at on public.drivers
  for each row execute function public.drivers_end_video_use_on_delete();

