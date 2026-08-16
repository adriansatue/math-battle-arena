create table if not exists public.battle_reward_receipts (
  battle_id uuid not null references public.battles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  xp_earned integer not null check (xp_earned >= 0),
  coins_earned integer not null check (coins_earned >= 0),
  rating_delta integer not null,
  xp_before integer not null check (xp_before >= 0),
  xp_after integer not null check (xp_after >= 0),
  coins_before integer not null check (coins_before >= 0),
  coins_after integer not null check (coins_after >= 0),
  rating_before integer not null check (rating_before >= 0),
  rating_after integer not null check (rating_after >= 0),
  level_before integer not null check (level_before between 1 and 100),
  level_after integer not null check (level_after between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (battle_id, user_id)
);

alter table public.battle_reward_receipts enable row level security;

revoke all on table public.battle_reward_receipts from public, anon, authenticated;

create or replace function public.settle_profile_battle_result(
  p_battle_id uuid,
  p_profile_id uuid,
  p_earned_xp integer,
  p_earned_coins integer,
  p_is_winner boolean,
  p_is_draw boolean,
  p_record_match boolean,
  p_rating_delta integer
)
returns setof public.battle_reward_receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_receipt public.battle_reward_receipts%rowtype;
  v_level_after integer;
begin
  if p_earned_xp < 0 or p_earned_coins < 0 then
    raise exception 'earned rewards must be nonnegative';
  end if;

  if p_is_winner and p_is_draw then
    raise exception 'winner and draw flags cannot both be true';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_battle_id::text || ':' || p_profile_id::text, 0));

  select * into v_receipt
  from public.battle_reward_receipts
  where battle_id = p_battle_id and user_id = p_profile_id;

  if found then
    return next v_receipt;
    return;
  end if;

  select * into strict v_profile
  from public.profiles
  where id = p_profile_id
  for update;

  v_level_after := public.profile_level_from_xp(coalesce(v_profile.total_points, 0) + p_earned_xp);

  update public.profiles
  set
    total_points = coalesce(total_points, 0) + p_earned_xp,
    points_balance = coalesce(points_balance, 0) + p_earned_coins,
    rating = greatest(0, coalesce(rating, 1000) + coalesce(p_rating_delta, 0)),
    wins = coalesce(wins, 0) + case when p_record_match and p_is_winner then 1 else 0 end,
    losses = coalesce(losses, 0) + case when p_record_match and not p_is_winner and not p_is_draw then 1 else 0 end,
    current_streak = case
      when not p_record_match then coalesce(current_streak, 0)
      when p_is_winner then coalesce(current_streak, 0) + 1
      when p_is_draw then coalesce(current_streak, 0)
      else 0
    end,
    best_streak = case
      when p_record_match and p_is_winner then greatest(coalesce(best_streak, 0), coalesce(current_streak, 0) + 1)
      else coalesce(best_streak, 0)
    end,
    level = v_level_after,
    rank_title = public.profile_rank_title_from_level(v_level_after)
  where id = p_profile_id;

  insert into public.battle_reward_receipts (
    battle_id, user_id, xp_earned, coins_earned, rating_delta,
    xp_before, xp_after, coins_before, coins_after,
    rating_before, rating_after, level_before, level_after
  ) values (
    p_battle_id,
    p_profile_id,
    p_earned_xp,
    p_earned_coins,
    p_rating_delta,
    coalesce(v_profile.total_points, 0),
    coalesce(v_profile.total_points, 0) + p_earned_xp,
    coalesce(v_profile.points_balance, 0),
    coalesce(v_profile.points_balance, 0) + p_earned_coins,
    coalesce(v_profile.rating, 1000),
    greatest(0, coalesce(v_profile.rating, 1000) + coalesce(p_rating_delta, 0)),
    public.profile_level_from_xp(coalesce(v_profile.total_points, 0)),
    v_level_after
  )
  returning * into v_receipt;

  return next v_receipt;
end;
$$;

revoke all on function public.settle_profile_battle_result(uuid, uuid, integer, integer, boolean, boolean, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.settle_profile_battle_result(uuid, uuid, integer, integer, boolean, boolean, boolean, integer)
  to service_role;

comment on table public.battle_reward_receipts is
  'Immutable per-player settlement receipts used to render exact post-battle progress.';