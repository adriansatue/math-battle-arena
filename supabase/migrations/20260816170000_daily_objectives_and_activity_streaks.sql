create table if not exists public.user_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  first_activity_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists public.daily_objective_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  objective_date date not null,
  objective_key text not null check (objective_key in ('correct_15', 'complete_battle', 'focused_practice')),
  target integer not null check (target > 0),
  progress integer not null default 0 check (progress >= 0),
  reward_coins integer not null check (reward_coins between 0 and 100),
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, objective_date, objective_key),
  constraint daily_objective_claim_requires_completion check (claimed_at is null or completed_at is not null)
);

create table if not exists public.daily_objective_contributions (
  user_id uuid not null references auth.users(id) on delete cascade,
  objective_date date not null,
  objective_key text not null,
  battle_id uuid not null references public.battles(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, objective_date, objective_key, battle_id),
  foreign key (user_id, objective_date, objective_key)
    references public.daily_objective_progress(user_id, objective_date, objective_key)
    on delete cascade
);

create index if not exists user_activity_days_user_date_idx
  on public.user_activity_days (user_id, activity_date desc);

create index if not exists daily_objective_progress_date_idx
  on public.daily_objective_progress (objective_date, objective_key);

alter table public.user_activity_days enable row level security;
alter table public.daily_objective_progress enable row level security;
alter table public.daily_objective_contributions enable row level security;

revoke all on table public.user_activity_days from public, anon, authenticated;
revoke all on table public.daily_objective_progress from public, anon, authenticated;
revoke all on table public.daily_objective_contributions from public, anon, authenticated;

create or replace function public.ensure_daily_objectives(
  p_user_id uuid,
  p_objective_date date default (now() at time zone 'utc')::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.daily_objective_progress (
    user_id, objective_date, objective_key, target, reward_coins
  ) values
    (p_user_id, p_objective_date, 'correct_15', 15, 20),
    (p_user_id, p_objective_date, 'complete_battle', 1, 25),
    (p_user_id, p_objective_date, 'focused_practice', 1, 25)
  on conflict (user_id, objective_date, objective_key) do nothing;
end;
$$;

create or replace function public.record_daily_activity(
  p_user_id uuid,
  p_battle_id uuid,
  p_correct_answers integer,
  p_is_competitive_battle boolean,
  p_is_focused_practice boolean,
  p_occurred_at timestamptz default now()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date date := (p_occurred_at at time zone 'utc')::date;
  v_inserted integer;
begin
  if p_correct_answers < 0 then
    raise exception 'correct answers must be nonnegative';
  end if;

  if not exists (
    select 1 from public.battles
    where id = p_battle_id
      and status = 'finished'
      and (host_id = p_user_id or guest_id = p_user_id)
  ) then
    raise exception 'finished battle does not belong to user';
  end if;

  perform public.ensure_daily_objectives(p_user_id, v_date);

  insert into public.user_activity_days (user_id, activity_date, first_activity_at)
  values (p_user_id, v_date, p_occurred_at)
  on conflict (user_id, activity_date) do nothing;

  if p_correct_answers > 0 then
    insert into public.daily_objective_contributions (
      user_id, objective_date, objective_key, battle_id, amount
    ) values (p_user_id, v_date, 'correct_15', p_battle_id, p_correct_answers)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      update public.daily_objective_progress
      set
        progress = least(target, progress + p_correct_answers),
        completed_at = case when progress + p_correct_answers >= target then coalesce(completed_at, p_occurred_at) else completed_at end
      where user_id = p_user_id and objective_date = v_date and objective_key = 'correct_15';
    end if;
  end if;

  if p_is_competitive_battle then
    insert into public.daily_objective_contributions (
      user_id, objective_date, objective_key, battle_id, amount
    ) values (p_user_id, v_date, 'complete_battle', p_battle_id, 1)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      update public.daily_objective_progress
      set progress = target, completed_at = coalesce(completed_at, p_occurred_at)
      where user_id = p_user_id and objective_date = v_date and objective_key = 'complete_battle';
    end if;
  end if;

  if p_is_focused_practice then
    insert into public.daily_objective_contributions (
      user_id, objective_date, objective_key, battle_id, amount
    ) values (p_user_id, v_date, 'focused_practice', p_battle_id, 1)
    on conflict do nothing;
    get diagnostics v_inserted = row_count;

    if v_inserted = 1 then
      update public.daily_objective_progress
      set progress = target, completed_at = coalesce(completed_at, p_occurred_at)
      where user_id = p_user_id and objective_date = v_date and objective_key = 'focused_practice';
    end if;
  end if;
end;
$$;

create or replace function public.claim_daily_objective(
  p_user_id uuid,
  p_objective_key text,
  p_objective_date date default (now() at time zone 'utc')::date
)
returns table (
  objective_key text,
  reward_coins integer,
  points_balance integer,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward integer;
  v_claimed_at timestamptz;
  v_points_balance integer;
begin
  select coalesce(p.points_balance, 0)
  into v_points_balance
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'profile not found';
  end if;

  update public.daily_objective_progress
  set claimed_at = now()
  where user_id = p_user_id
    and objective_date = p_objective_date
    and daily_objective_progress.objective_key = p_objective_key
    and completed_at is not null
    and daily_objective_progress.claimed_at is null
  returning daily_objective_progress.reward_coins, daily_objective_progress.claimed_at
  into v_reward, v_claimed_at;

  if v_reward is null then
    raise exception 'objective is incomplete or already claimed';
  end if;

  update public.profiles
  set points_balance = coalesce(profiles.points_balance, 0) + v_reward
  where id = p_user_id
  returning profiles.points_balance into v_points_balance;

  objective_key := p_objective_key;
  reward_coins := v_reward;
  points_balance := v_points_balance;
  claimed_at := v_claimed_at;
  return next;
end;
$$;

create or replace function public.get_daily_objective_summary(
  p_user_id uuid,
  p_today date default (now() at time zone 'utc')::date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  perform public.ensure_daily_objectives(p_user_id, p_today);

  with recursive
  days as (
    select activity_date
    from public.user_activity_days
    where user_id = p_user_id
  ),
  day_groups as (
    select
      activity_date,
      activity_date - row_number() over (order by activity_date)::integer as group_key
    from days
  ),
  day_streaks as (
    select min(activity_date) as start_date, max(activity_date) as end_date, count(*)::integer as length
    from day_groups
    group by group_key
  ),
  weeks as (
    select distinct activity_date - (extract(isodow from activity_date)::integer - 1) as week_start
    from days
  ),
  week_groups as (
    select
      week_start,
      week_start - (row_number() over (order by week_start)::integer * 7) as group_key
    from weeks
  ),
  week_streaks as (
    select min(week_start) as start_date, max(week_start) as end_date, count(*)::integer as length
    from week_groups
    group by group_key
  ),
  streak_summary as (
    select
      coalesce((select max(length) from day_streaks), 0) as best_days,
      coalesce((select length from day_streaks where end_date in (p_today, p_today - 1) order by end_date desc limit 1), 0) as current_days,
      coalesce((select max(length) from week_streaks), 0) as best_weeks,
      coalesce((select length from week_streaks where end_date in (
        p_today - (extract(isodow from p_today)::integer - 1),
        p_today - (extract(isodow from p_today)::integer - 1) - 7
      ) order by end_date desc limit 1), 0) as current_weeks,
      (select count(*)::integer from days) as total_days,
      (select count(*)::integer from weeks) as total_weeks
  )
  select jsonb_build_object(
    'date', p_today,
    'timezone', 'UTC',
    'resets_at', ((p_today + 1)::timestamp at time zone 'UTC'),
    'objectives', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', objective_key,
        'target', target,
        'progress', progress,
        'reward_coins', reward_coins,
        'completed', completed_at is not null,
        'claimed', claimed_at is not null
      ) order by case objective_key
        when 'correct_15' then 1
        when 'complete_battle' then 2
        else 3
      end)
      from public.daily_objective_progress
      where user_id = p_user_id and objective_date = p_today
    ), '[]'::jsonb),
    'streaks', (select to_jsonb(streak_summary) from streak_summary)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.ensure_daily_objectives(uuid, date) from public, anon, authenticated;
revoke all on function public.record_daily_activity(uuid, uuid, integer, boolean, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_daily_objective(uuid, text, date) from public, anon, authenticated;
revoke all on function public.get_daily_objective_summary(uuid, date) from public, anon, authenticated;

grant execute on function public.ensure_daily_objectives(uuid, date) to service_role;
grant execute on function public.record_daily_activity(uuid, uuid, integer, boolean, boolean, timestamptz) to service_role;
grant execute on function public.claim_daily_objective(uuid, text, date) to service_role;
grant execute on function public.get_daily_objective_summary(uuid, date) to service_role;

comment on table public.user_activity_days is
  'Permanent UTC dates on which a player completed a battle or practice session. Missing days never delete history.';
comment on table public.daily_objective_progress is
  'Three fixed UTC daily objectives with bounded, idempotent coin rewards.';