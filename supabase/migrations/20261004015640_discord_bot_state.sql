create table public.discord_bot_state (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.discord_bot_state enable row level security;
revoke all on public.discord_bot_state from anon, authenticated;
