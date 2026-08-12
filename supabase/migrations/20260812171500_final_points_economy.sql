-- Final points economy:
-- total_points is lifetime XP, points_balance is spendable coins, and rating is
-- only adjusted for real PvP battles.

alter table public.profiles
  add column if not exists rating integer not null default 1000;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_rating_nonnegative') then
    alter table public.profiles
      add constraint profiles_rating_nonnegative
      check (rating >= 0) not valid;
  end if;
end $$;

drop function if exists public.apply_profile_battle_result(uuid, integer, boolean, boolean);

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
  )
  update public.profiles p
  set
    level = case
      when u.total_points >= 35000 then 8
      when u.total_points >= 20000 then 7
      when u.total_points >= 12000 then 6
      when u.total_points >= 7000 then 5
      when u.total_points >= 3500 then 4
      when u.total_points >= 1500 then 3
      when u.total_points >= 500 then 2
      else 1
    end,
    rank_title = case
      when u.total_points >= 35000 then 'Grand Mathematician'
      when u.total_points >= 20000 then 'Math Prodigy'
      when u.total_points >= 12000 then 'Algebra Champion'
      when u.total_points >= 7000 then 'Calc Wizard'
      when u.total_points >= 3500 then 'Formula Master'
      when u.total_points >= 1500 then 'Equation Solver'
      when u.total_points >= 500 then 'Number Cruncher'
      else 'Math Rookie'
    end
  from updated u
  where p.id = u.id;
end;
$$;

revoke all on function public.apply_profile_battle_result(uuid, integer, integer, boolean, boolean, boolean, integer)
  from public, anon, authenticated;
grant execute on function public.apply_profile_battle_result(uuid, integer, integer, boolean, boolean, boolean, integer)
  to service_role;
