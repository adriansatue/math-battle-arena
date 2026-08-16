create table if not exists public.weekly_competition_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  division smallint not null check (division between 1 and 10),
  xp_earned integer not null default 0 check (xp_earned >= 0),
  rating_change integer not null default 0,
  battles_completed integer not null default 0 check (battles_completed >= 0),
  battles_won integer not null default 0 check (battles_won >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  attempts integer not null default 0 check (attempts >= 0),
  best_score integer not null default 0 check (best_score >= 0),
  first_played_at timestamptz not null,
  last_played_at timestamptz not null,
  primary key (user_id, week_start)
);

create table if not exists public.weekly_competition_contributions (
  user_id uuid not null references auth.users(id) on delete cascade,
  battle_id uuid not null references public.battles(id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, battle_id)
);

create table if not exists public.weekly_topic_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  topic text not null,
  attempts integer not null default 0 check (attempts >= 0),
  correct_answers integer not null default 0 check (correct_answers >= 0),
  primary key (user_id, week_start, topic),
  foreign key (user_id, week_start)
    references public.weekly_competition_entries(user_id, week_start) on delete cascade
);

create table if not exists public.weekly_reward_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  division smallint not null check (division between 1 and 10),
  final_rank integer not null check (final_rank > 0),
  cohort_size integer not null check (cohort_size > 0),
  reward_coins integer not null check (reward_coins between 0 and 250),
  claimed_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index if not exists weekly_competition_rank_idx
  on public.weekly_competition_entries (week_start, division, xp_earned desc, battles_won desc, last_played_at);

alter table public.weekly_competition_entries enable row level security;
alter table public.weekly_competition_contributions enable row level security;
alter table public.weekly_topic_stats enable row level security;
alter table public.weekly_reward_claims enable row level security;

revoke all on table public.weekly_competition_entries from public, anon, authenticated;
revoke all on table public.weekly_competition_contributions from public, anon, authenticated;
revoke all on table public.weekly_topic_stats from public, anon, authenticated;
revoke all on table public.weekly_reward_claims from public, anon, authenticated;

create or replace function public.record_weekly_competition_result(
  p_user_id uuid,
  p_battle_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.battles%rowtype;
  v_receipt public.battle_reward_receipts%rowtype;
  v_week_start date;
  v_division smallint;
  v_attempts integer;
  v_correct integer;
  v_score integer;
  v_inserted integer;
begin
  select * into strict v_battle
  from public.battles
  where id = p_battle_id and status = 'finished';

  if v_battle.guest_id is null or v_battle.bot_id is not null
    or p_user_id not in (v_battle.host_id, v_battle.guest_id) then
    return;
  end if;

  select * into strict v_receipt
  from public.battle_reward_receipts
  where battle_id = p_battle_id and user_id = p_user_id;

  v_week_start := (v_battle.finished_at at time zone 'utc')::date
    - (extract(isodow from (v_battle.finished_at at time zone 'utc')::date)::integer - 1);
  v_division := least(10, greatest(1, ((v_receipt.level_before - 1) / 10) + 1));

  select
    count(*)::integer,
    count(*) filter (where ba.is_correct)::integer
  into v_attempts, v_correct
  from public.battle_answers ba
  where ba.battle_id = p_battle_id
    and ba.player_id = p_user_id
    and coalesce(ba.flagged, false) = false;

  v_score := case when p_user_id = v_battle.host_id
    then coalesce(v_battle.host_score, 0) else coalesce(v_battle.guest_score, 0) end;

  insert into public.weekly_competition_contributions (user_id, battle_id, week_start)
  values (p_user_id, p_battle_id, v_week_start)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return; end if;

  insert into public.weekly_competition_entries (
    user_id, week_start, division, xp_earned, rating_change, battles_completed,
    battles_won, correct_answers, attempts, best_score, first_played_at, last_played_at
  ) values (
    p_user_id, v_week_start, v_division, v_receipt.xp_earned, v_receipt.rating_delta, 1,
    case when v_battle.winner_id = p_user_id then 1 else 0 end,
    v_correct, v_attempts, v_score, v_battle.finished_at, v_battle.finished_at
  )
  on conflict (user_id, week_start) do update set
    xp_earned = weekly_competition_entries.xp_earned + excluded.xp_earned,
    rating_change = weekly_competition_entries.rating_change + excluded.rating_change,
    battles_completed = weekly_competition_entries.battles_completed + 1,
    battles_won = weekly_competition_entries.battles_won + excluded.battles_won,
    correct_answers = weekly_competition_entries.correct_answers + excluded.correct_answers,
    attempts = weekly_competition_entries.attempts + excluded.attempts,
    best_score = greatest(weekly_competition_entries.best_score, excluded.best_score),
    last_played_at = greatest(weekly_competition_entries.last_played_at, excluded.last_played_at);

  insert into public.weekly_topic_stats (user_id, week_start, topic, attempts, correct_answers)
  select
    p_user_id,
    v_week_start,
    bq.category,
    count(*)::integer,
    count(*) filter (where ba.is_correct)::integer
  from public.battle_answers ba
  join public.battle_questions bq on bq.id = ba.question_id
  where ba.battle_id = p_battle_id
    and ba.player_id = p_user_id
    and coalesce(ba.flagged, false) = false
  group by bq.category
  on conflict (user_id, week_start, topic) do update set
    attempts = weekly_topic_stats.attempts + excluded.attempts,
    correct_answers = weekly_topic_stats.correct_answers + excluded.correct_answers;
end;
$$;

create or replace function public.get_weekly_competition_summary(
  p_user_id uuid,
  p_today date default (now() at time zone 'utc')::date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week date := p_today - (extract(isodow from p_today)::integer - 1);
  v_previous_week date := v_week - 7;
  v_division smallint;
  v_result jsonb;
begin
  select division into v_division
  from public.weekly_competition_entries
  where user_id = p_user_id and week_start = v_week;

  if v_division is null then
    select least(10, greatest(1, ((public.profile_level_from_xp(coalesce(total_points, 0)) - 1) / 10) + 1))
    into v_division from public.profiles where id = p_user_id;
  end if;

  with ranked as (
    select
      e.*,
      p.username,
      p.rating,
      public.profile_level_from_xp(coalesce(p.total_points, 0)) as level,
      row_number() over (
        order by e.xp_earned desc, e.battles_won desc, e.last_played_at, e.user_id
      )::integer as rank
    from public.weekly_competition_entries e
    join public.profiles p on p.id = e.user_id
    where e.week_start = v_week and e.division = v_division
  ), personal as (
    select * from ranked where user_id = p_user_id
  ), previous as (
    select e.*,
      row_number() over (
        partition by e.division
        order by e.xp_earned desc, e.battles_won desc, e.last_played_at, e.user_id
      )::integer as rank,
      count(*) over (partition by e.division)::integer as cohort_size
    from public.weekly_competition_entries e
    where e.week_start = v_previous_week
  ), strongest as (
    select topic from public.weekly_topic_stats
    where user_id = p_user_id and week_start = v_week and attempts > 0
    order by correct_answers::numeric / attempts desc, attempts desc, topic limit 1
  ), weakest as (
    select topic from public.weekly_topic_stats
    where user_id = p_user_id and week_start = v_week and attempts > 0
    order by correct_answers::numeric / attempts, attempts desc, topic limit 1
  )
  select jsonb_build_object(
    'week_start', v_week,
    'week_end', v_week + 6,
    'division', v_division,
    'division_label', 'Division ' || v_division,
    'minimum_cohort_size', 3,
    'leaderboard', coalesce((select jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'username', username, 'rank', rank, 'xp_earned', xp_earned,
      'rating', rating, 'level', level,
      'battles_completed', battles_completed, 'battles_won', battles_won,
      'accuracy', case when attempts > 0 then round(100.0 * correct_answers / attempts, 1) else null end
    ) order by rank) from (select * from ranked limit 50) top_players), '[]'::jsonb),
    'personal', coalesce((select jsonb_build_object(
      'rank', personal.rank, 'xp_earned', personal.xp_earned, 'rating_change', personal.rating_change,
      'battles_completed', personal.battles_completed, 'battles_won', personal.battles_won,
      'accuracy', case when personal.attempts > 0
        then round(100.0 * personal.correct_answers / personal.attempts, 1) else null end,
      'accuracy_change', case when previous_entry.attempts > 0 and personal.attempts > 0
        then round(100.0 * personal.correct_answers / personal.attempts
          - 100.0 * previous_entry.correct_answers / previous_entry.attempts, 1) else null end,
      'best_score', personal.best_score,
      'strongest_topic', (select topic from strongest),
      'weakest_topic', (select topic from weakest)
    ) from personal left join public.weekly_competition_entries previous_entry
      on previous_entry.user_id = personal.user_id and previous_entry.week_start = v_previous_week), 'null'::jsonb),
    'previous_reward', (select jsonb_build_object(
      'week_start', v_previous_week, 'rank', previous.rank, 'cohort_size', previous.cohort_size,
      'reward_coins', case when previous.cohort_size < 3 then 50 when previous.rank = 1 then 200
        when previous.rank = 2 then 150 when previous.rank = 3 then 100 else 50 end,
      'claimed', claims.claimed_at is not null
    ) from previous left join public.weekly_reward_claims claims
      on claims.user_id = previous.user_id and claims.week_start = previous.week_start
      where previous.user_id = p_user_id)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.claim_weekly_competition_reward(
  p_user_id uuid,
  p_week_start date,
  p_today date default (now() at time zone 'utc')::date
)
returns setof public.weekly_reward_claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_week date := p_today - (extract(isodow from p_today)::integer - 1);
  v_entry public.weekly_competition_entries%rowtype;
  v_rank integer;
  v_cohort integer;
  v_reward integer;
  v_claim public.weekly_reward_claims%rowtype;
begin
  if p_week_start >= v_current_week then raise exception 'week is not closed'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_week_start::text, 0));

  select * into v_claim from public.weekly_reward_claims
  where user_id = p_user_id and week_start = p_week_start;
  if found then return next v_claim; return; end if;

  select * into strict v_entry from public.weekly_competition_entries
  where user_id = p_user_id and week_start = p_week_start and battles_completed > 0;

  select rank, cohort_size into v_rank, v_cohort from (
    select user_id,
      row_number() over (order by xp_earned desc, battles_won desc, last_played_at, user_id)::integer as rank,
      count(*) over ()::integer as cohort_size
    from public.weekly_competition_entries
    where week_start = p_week_start and division = v_entry.division
  ) ranked where user_id = p_user_id;

  v_reward := case when v_cohort < 3 then 50 when v_rank = 1 then 200
    when v_rank = 2 then 150 when v_rank = 3 then 100 else 50 end;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile not found'; end if;
  update public.profiles set points_balance = coalesce(points_balance, 0) + v_reward where id = p_user_id;

  insert into public.weekly_reward_claims (user_id, week_start, division, final_rank, cohort_size, reward_coins)
  values (p_user_id, p_week_start, v_entry.division, v_rank, v_cohort, v_reward)
  returning * into v_claim;
  return next v_claim;
end;
$$;

revoke all on function public.record_weekly_competition_result(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_weekly_competition_summary(uuid, date) from public, anon, authenticated;
revoke all on function public.claim_weekly_competition_reward(uuid, date, date) from public, anon, authenticated;
grant execute on function public.record_weekly_competition_result(uuid, uuid) to service_role;
grant execute on function public.get_weekly_competition_summary(uuid, date) to service_role;
grant execute on function public.claim_weekly_competition_reward(uuid, date, date) to service_role;
