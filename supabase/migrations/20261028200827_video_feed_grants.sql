-- The video feed tables had RLS policies but no table grants -> moderator page got 'permission denied'.
grant select, insert, update, delete on public.video_channels to authenticated;
grant select on public.video_items to authenticated;
