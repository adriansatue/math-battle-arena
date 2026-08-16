-- Expand account progression from the old 8-level curve to a 100-level curve.
-- total_points remains lifetime XP; points_balance remains spendable coins.

create or replace function public.profile_level_from_xp(p_total_xp integer)
returns integer
language sql
immutable
set search_path = public
as $$
  select coalesce(max(level_value), 1)
  from generate_series(1, 100) as level_value
  where greatest(coalesce(p_total_xp, 0), 0) >= round(100 * power((level_value - 1)::numeric, 1.7))::integer;
$$;

create or replace function public.profile_rank_title_from_level(p_level integer)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when greatest(coalesce(p_level, 1), 1) >= 91 then 'Grand Mathematician'
    when greatest(coalesce(p_level, 1), 1) >= 81 then 'Elite Mathematician'
    when greatest(coalesce(p_level, 1), 1) >= 71 then 'Battle Contender'
    when greatest(coalesce(p_level, 1), 1) >= 61 then 'Algebra Expert'
    when greatest(coalesce(p_level, 1), 1) >= 51 then 'Fraction Specialist'
    when greatest(coalesce(p_level, 1), 1) >= 41 then 'Formula Strategist'
    when greatest(coalesce(p_level, 1), 1) >= 31 then 'Equation Solver'
    when greatest(coalesce(p_level, 1), 1) >= 21 then 'Times Table Trainer'
    when greatest(coalesce(p_level, 1), 1) >= 11 then 'Number Builder'
    else 'Math Rookie'
  end;
$$;

create or replace function public.apply_profile_battle_result(
  p_profile_id uuid,
  p_earned_xp integer,
  p_earned_coins integer,
  p_is_winner boolean,
  p_is_draw boolean,
  p_record_match boolean,
  p_rating_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_earned_xp < 0 then
    raise exception 'earned xp must be nonnegative';
  end if;

  if p_earned_coins < 0 then
    raise exception 'earned coins must be nonnegative';
  end if;

  if p_is_winner and p_is_draw then
    raise exception 'winner and draw flags cannot both be true';
  end if;

  with updated as (
    update public.profiles
    set
      total_points = coalesce(total_points, 0) + p_earned_xp,
      points_balance = coalesce(points_balance, 0) + p_earned_coins,
      rating = greatest(0, coalesce(rating, 1000) + coalesce(p_rating_delta, 0)),
      wins = coalesce(wins, 0) + case
        when p_record_match and p_is_winner then 1
        else 0
      end,
      losses = coalesce(losses, 0) + case
        when p_record_match and not p_is_winner and not p_is_draw then 1
        else 0
      end,
      current_streak = case
        when not p_record_match then coalesce(current_streak, 0)
        when p_is_winner then coalesce(current_streak, 0) + 1
        when p_is_draw then coalesce(current_streak, 0)
        else 0
      end,
      best_streak = case
        when p_record_match and p_is_winner then greatest(coalesce(best_streak, 0), coalesce(current_streak, 0) + 1)
        else coalesce(best_streak, 0)
      end
    where id = p_profile_id
    returning id, total_points
  ),
  computed as (
    select
      id,
      total_points,
      public.profile_level_from_xp(total_points) as computed_level
    from updated
  )
  update public.profiles p
  set
    level = computed.computed_level,
    rank_title = public.profile_rank_title_from_level(computed.computed_level)
  from computed
  where p.id = computed.id;
end;
$$;

revoke all on function public.apply_profile_battle_result(uuid, integer, integer, boolean, boolean, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.apply_profile_battle_result(uuid, integer, integer, boolean, boolean, boolean, integer)
  to service_role;

with computed as (
  select
    id,
    public.profile_level_from_xp(total_points) as computed_level
  from public.profiles
  where rank_title is distinct from 'AI Challenger'
    and coalesce(username, '') not ilike '%MathBot%'
)
update public.profiles p
set
  level = computed.computed_level,
  rank_title = public.profile_rank_title_from_level(computed.computed_level)
from computed
where p.id = computed.id;
