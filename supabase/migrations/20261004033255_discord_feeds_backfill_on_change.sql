create trigger discord_feeds_backfill_on_change after update of native_events on public.discord_feeds
  for each row when (old.native_events is distinct from new.native_events)
  execute function public.discord_enqueue_backfill();
