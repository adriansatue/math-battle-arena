create table if not exists public.user_email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reengagement_opt_in boolean not null default false,
  opted_in_at timestamptz,
  unsubscribed_at timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint email_opt_in_timestamp_check check (not reengagement_opt_in or opted_in_at is not null)
);

create table if not exists public.email_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_key text not null check (char_length(campaign_key) between 1 and 100),
  provider_message_id text,
  status text not null check (status in ('pending', 'sent', 'failed')),
  error_code text,
  reserved_at timestamptz not null default now(),
  sent_at timestamptz,
  clicked_at timestamptz,
  unique (user_id, campaign_key)
);

create index if not exists email_delivery_user_sent_idx
  on public.email_delivery_log (user_id, sent_at desc) where status = 'sent';

alter table public.user_email_preferences enable row level security;
alter table public.email_delivery_log enable row level security;
revoke all on table public.user_email_preferences from public, anon, authenticated;
revoke all on table public.email_delivery_log from public, anon, authenticated;

create or replace function public.get_reengagement_candidates(
  p_inactive_days integer default 7,
  p_limit integer default 10
)
returns table (
  user_id uuid,
  email text,
  username text,
  unsubscribe_token uuid,
  last_activity_at timestamptz,
  inactive_days integer
)
language sql
security definer
set search_path = public, auth
as $$
  select
    users.id,
    users.email,
    coalesce(nullif(profiles.username, ''), 'Math Challenger'),
    preferences.unsubscribe_token,
    activity.last_activity_at,
    greatest(0, floor(extract(epoch from (now() - activity.last_activity_at)) / 86400))::integer
  from auth.users users
  join public.profiles profiles on profiles.id = users.id
  join public.user_email_preferences preferences on preferences.user_id = users.id
  cross join lateral (
    select greatest(
      coalesce((select max(days.first_activity_at) from public.user_activity_days days where days.user_id = users.id), '-infinity'::timestamptz),
      coalesce((select max(events.occurred_at) from public.product_events events where events.user_id = users.id), '-infinity'::timestamptz),
      coalesce(users.last_sign_in_at, '-infinity'::timestamptz),
      users.created_at
    ) as last_activity_at
  ) activity
  where preferences.reengagement_opt_in
    and preferences.unsubscribed_at is null
    and users.email is not null
    and users.email_confirmed_at is not null
    and coalesce(users.is_anonymous, false) = false
    and users.email not ilike '%@mathbattle.internal'
    and coalesce(profiles.rank_title, '') <> 'AI Challenger'
    and activity.last_activity_at <= now() - make_interval(days => greatest(1, p_inactive_days))
    and not exists (
      select 1 from public.email_delivery_log deliveries
      where deliveries.user_id = users.id
        and deliveries.status = 'sent'
        and deliveries.sent_at >= now() - interval '30 days'
    )
  order by activity.last_activity_at, users.id
  limit least(25, greatest(1, p_limit));
$$;

create or replace function public.reserve_reengagement_email(
  p_user_id uuid,
  p_campaign_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  if not exists (
    select 1 from public.user_email_preferences
    where user_id = p_user_id and reengagement_opt_in and unsubscribed_at is null
  ) then return false; end if;

  insert into public.email_delivery_log (user_id, campaign_key, status)
  values (p_user_id, p_campaign_key, 'pending')
  on conflict (user_id, campaign_key) do nothing;
  get diagnostics v_inserted = row_count;
  return v_inserted = 1;
end;
$$;

revoke all on function public.get_reengagement_candidates(integer, integer) from public, anon, authenticated;
revoke all on function public.reserve_reengagement_email(uuid, text) from public, anon, authenticated;
grant execute on function public.get_reengagement_candidates(integer, integer) to service_role;
grant execute on function public.reserve_reengagement_email(uuid, text) to service_role;

comment on table public.user_email_preferences is
  'Explicit user consent for optional re-engagement email. Existing accounts default to opted out.';
comment on table public.email_delivery_log is
  'Auditable, deduplicated delivery state. Recipient addresses and email bodies are not stored here.';
