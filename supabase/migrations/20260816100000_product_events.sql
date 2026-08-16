create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'account_started',
    'guest_upgraded',
    'lobby_viewed',
    'matchmaking_started',
    'match_found',
    'bot_fallback_started',
    'battle_started',
    'battle_finished',
    'results_viewed',
    'answer_review_opened',
    'play_again_clicked',
    'recommended_practice_clicked',
    'practice_started',
    'practice_finished',
    'rematch_requested',
    'rematch_started',
    'pack_opened',
    'profile_insight_viewed'
  )),
  source text not null check (source in ('client', 'server')),
  session_id uuid,
  battle_id uuid references public.battles(id) on delete set null,
  dedup_key text not null check (char_length(dedup_key) between 1 and 160),
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint product_events_properties_object check (jsonb_typeof(properties) = 'object'),
  constraint product_events_properties_size check (octet_length(properties::text) <= 4096),
  constraint product_events_user_event_dedup unique (user_id, event_name, dedup_key)
);

create index if not exists product_events_name_occurred_at_idx
  on public.product_events (event_name, occurred_at desc);

create index if not exists product_events_user_occurred_at_idx
  on public.product_events (user_id, occurred_at desc);

alter table public.product_events enable row level security;

revoke all on table public.product_events from public, anon, authenticated;

comment on table public.product_events is
  'First-party product events. Written by trusted server routes; not directly readable by clients.';

comment on column public.product_events.properties is
  'Small allowlisted scalar properties only; do not store email, username, answer text, or free text.';