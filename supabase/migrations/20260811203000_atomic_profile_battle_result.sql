-- Apply finished-battle rewards with one row-level update so concurrent battle
-- finishes for the same player cannot overwrite each other's profile totals.
create or replace function public.apply_profile_battle_result(
  p_profile_id uuid,
  p_earned_points integer,
  p_is_winner boolean,
  p_is_draw boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_earned_points < 0 then
    raise exception 'earned points must be nonnegative';
  end if;

  if p_is_winner and p_is_draw then
    raise exception 'winner and draw flags cannot both be true';
  end if;

  with updated as (
    update public.profiles
    set
      total_points = coalesce(total_points, 0) + p_earned_points,
      points_balance = coalesce(points_balance, total_points, 0) + p_earned_points,
      wins = coalesce(wins, 0) + case when p_is_winner then 1 else 0 end,
      losses = coalesce(losses, 0) + case when not p_is_winner and not p_is_draw then 1 else 0 end,
      current_streak = case
        when p_is_winner then coalesce(current_streak, 0) + 1
        when p_is_draw then coalesce(current_streak, 0)
        else 0
      end,
      best_streak = case
        when p_is_winner then greatest(coalesce(best_streak, 0), coalesce(current_streak, 0) + 1)
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

revoke all on function public.apply_profile_battle_result(uuid, integer, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_profile_battle_result(uuid, integer, boolean, boolean)
  to service_role;
