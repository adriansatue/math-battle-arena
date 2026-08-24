-- Exact, server-only aggregates for the administration dashboard.
-- Browser roles cannot execute these functions directly.

create or replace function public.get_admin_dashboard_metrics(p_now timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with periods as (
  select
    p_now - interval '7 days' as current_start,
    p_now - interval '14 days' as previous_start
), real_profiles as (
  select id
  from public.profiles
  where coalesce(rank_title, '') <> 'AI Challenger'
    and coalesce(username, '') not ilike '%MathBot%'
), battle_activity as (
  select host_id as user_id, created_at, status
  from public.battles where host_id is not null
  union all
  select guest_id, created_at, status
  from public.battles where guest_id is not null
), active_dates as (
  select user_id, max(occurred_at) as last_active_at
  from (
    select user_id, created_at as occurred_at from battle_activity
    union all
    select player_id, answered_at from public.battle_answers where player_id is not null
  ) activity
  group by user_id
), event_funnel(event_name, step_order) as (
  values
    ('lobby_viewed', 1),
    ('matchmaking_started', 2),
    ('match_found', 3),
    ('battle_started', 4),
    ('battle_finished', 5),
    ('results_viewed', 6),
    ('recommended_practice_clicked', 7),
    ('practice_started', 8),
    ('practice_finished', 9)
), funnel_counts as (
  select event_name, count(distinct user_id)::integer as players
  from public.product_events, periods
  where occurred_at >= periods.current_start
  group by event_name
), summary as (
  select jsonb_build_object(
    'totalUsers', (select count(*) from public.profiles),
    'realPlayers', (select count(*) from real_profiles),
    'activePlayers', (select count(*) from active_dates ad join real_profiles rp on rp.id = ad.user_id),
    'activePlayersLast7Days', (select count(*) from active_dates ad join real_profiles rp on rp.id = ad.user_id, periods where ad.last_active_at >= periods.current_start),
    'totalBattles', (select count(*) from public.battles),
    'activeBattles', (select count(*) from public.battles where status = 'active'),
    'finishedBattles', (select count(*) from public.battles where status = 'finished'),
    'waitingBattles', (select count(*) from public.battles where status = 'waiting'),
    'pvpBattles', (select count(*) from public.battles where guest_id is not null and bot_id is null),
    'botBattles', (select count(*) from public.battles where guest_id is not null and bot_id is not null),
    'practiceBattles', (select count(*) from public.battles where guest_id is null),
    'battlesLast7Days', (select count(*) from public.battles, periods where created_at >= periods.current_start),
    'answers', (select count(*) from public.battle_answers),
    'answersLast7Days', (select count(*) from public.battle_answers, periods where answered_at >= periods.current_start),
    'accuracy', coalesce((select round(100.0 * count(*) filter (where is_correct) / nullif(count(*), 0)) from public.battle_answers), 0),
    'averageResponseMs', (select round(avg(nullif(time_taken_ms, 0))) from public.battle_answers),
    'flaggedAnswers', (select count(*) from public.battle_answers where flagged),
    'totalCards', (select count(*) from public.reward_catalog),
    'activeCards', (select count(*) from public.reward_catalog where is_active),
    'inventoryCards', (select count(*) from public.user_inventory),
    'queueSize', (select count(*) from public.matchmaking_queue)
  ) as value
), trends as (
  select jsonb_build_object(
    'current', jsonb_build_object(
      'battles', count(*) filter (where b.created_at >= p.current_start),
      'finishedBattles', count(*) filter (where b.created_at >= p.current_start and b.status = 'finished'),
      'answers', (select count(*) from public.battle_answers where answered_at >= p.current_start)
    ),
    'previous', jsonb_build_object(
      'battles', count(*) filter (where b.created_at >= p.previous_start and b.created_at < p.current_start),
      'finishedBattles', count(*) filter (where b.created_at >= p.previous_start and b.created_at < p.current_start and b.status = 'finished'),
      'answers', (select count(*) from public.battle_answers where answered_at >= p.previous_start and answered_at < p.current_start)
    )
  ) as value
  from periods p
  left join public.battles b on true
  group by p.current_start, p.previous_start
), alerts as (
  select jsonb_build_object(
    'staleActiveBattles', count(*) filter (
      where status = 'active' and coalesce(started_at, created_at) < p_now - interval '30 minutes'
    ),
    'staleWaitingBattles', count(*) filter (
      where status = 'waiting' and created_at < p_now - interval '15 minutes'
    ),
    'flaggedPlayers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', flagged.id,
        'username', flagged.username,
        'flaggedAnswers', flagged.flagged_answers
      ) order by flagged.flagged_answers desc)
      from (
        select p.id, coalesce(p.username, 'Jugador sin nombre') as username,
          count(*)::integer as flagged_answers
        from public.battle_answers answer
        join public.profiles p on p.id = answer.player_id
        where answer.flagged
        group by p.id, p.username
        order by count(*) desc
        limit 5
      ) flagged
    ), '[]'::jsonb)
  ) as value
  from public.battles
)
select jsonb_build_object(
  'summary', summary.value,
  'trends', trends.value,
  'alerts', alerts.value,
  'funnel', coalesce((
    select jsonb_agg(jsonb_build_object(
      'eventName', ef.event_name,
      'players', coalesce(fc.players, 0)
    ) order by ef.step_order)
    from event_funnel ef
    left join funnel_counts fc using (event_name)
  ), '[]'::jsonb)
)
from summary cross join trends cross join alerts;
$$;

revoke all on function public.get_admin_dashboard_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_metrics(timestamptz) to service_role;

create or replace function public.get_admin_dashboard_players(
  p_search text default '',
  p_attention_only boolean default false,
  p_sort text default 'lastPlayedAt',
  p_direction text default 'desc',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with battle_rows as (
  select host_id as user_id, id, status, winner_id, guest_id, bot_id,
    coalesce(finished_at, started_at, created_at) as activity_at
  from public.battles where host_id is not null
  union all
  select guest_id, id, status, winner_id, guest_id, bot_id,
    coalesce(finished_at, started_at, created_at)
  from public.battles where guest_id is not null
), battle_stats as (
  select user_id,
    count(*)::integer as battles_played,
    count(*) filter (where guest_id is null)::integer as practice_battles,
    count(*) filter (where guest_id is not null and bot_id is not null)::integer as bot_battles,
    count(*) filter (where guest_id is not null and bot_id is null)::integer as pvp_battles,
    max(activity_at) as last_battle_at
  from battle_rows group by user_id
), answer_stats as (
  select player_id as user_id,
    count(*)::integer as answers,
    count(*) filter (where is_correct)::integer as correct_answers,
    round(avg(nullif(time_taken_ms, 0)))::integer as avg_response_ms,
    count(*) filter (where flagged)::integer as flagged_answers,
    max(answered_at) as last_answer_at
  from public.battle_answers group by player_id
), inventory_stats as (
  select user_id, count(*)::integer as cards_owned
  from public.user_inventory group by user_id
), player_rows as (
  select
    p.id,
    coalesce(p.username, 'Jugador sin nombre') as username,
    coalesce(p.level, 0)::integer as level,
    coalesce(p.rank_title, 'Sin rango') as rank_title,
    coalesce(p.total_points, 0)::integer as total_points,
    coalesce(p.points_balance, 0)::integer as points_balance,
    coalesce(p.rating, 1000)::integer as rating,
    coalesce(p.wins, 0)::integer as profile_wins,
    coalesce(p.losses, 0)::integer as profile_losses,
    coalesce(bs.battles_played, 0) as battles_played,
    coalesce(bs.pvp_battles, 0) as pvp_battles,
    coalesce(bs.bot_battles, 0) as bot_battles,
    coalesce(bs.practice_battles, 0) as practice_battles,
    coalesce(ans.answers, 0) as answers,
    case when coalesce(ans.answers, 0) = 0 then 0
      else round(100.0 * ans.correct_answers / ans.answers)::integer end as accuracy,
    ans.avg_response_ms,
    coalesce(ans.flagged_answers, 0) as flagged_answers,
    coalesce(inv.cards_owned, 0) as cards_owned,
    greatest(bs.last_battle_at, ans.last_answer_at) as last_played_at
  from public.profiles p
  left join battle_stats bs on bs.user_id = p.id
  left join answer_stats ans on ans.user_id = p.id
  left join inventory_stats inv on inv.user_id = p.id
  where coalesce(p.rank_title, '') <> 'AI Challenger'
    and coalesce(p.username, '') not ilike '%MathBot%'
    and (coalesce(trim(p_search), '') = '' or p.username ilike '%' || trim(p_search) || '%')
    and (not p_attention_only or coalesce(ans.flagged_answers, 0) > 0)
), counted as (
  select *, count(*) over ()::integer as total
  from player_rows
), paged as (
  select * from counted
  order by
    case when p_sort = 'flaggedAnswers' and p_direction = 'desc' then flagged_answers end desc nulls last,
    case when p_sort = 'flaggedAnswers' and p_direction = 'asc' then flagged_answers end asc nulls last,
    case when p_sort = 'battlesPlayed' and p_direction = 'desc' then battles_played end desc nulls last,
    case when p_sort = 'battlesPlayed' and p_direction = 'asc' then battles_played end asc nulls last,
    case when p_sort = 'rating' and p_direction = 'desc' then rating end desc nulls last,
    case when p_sort = 'rating' and p_direction = 'asc' then rating end asc nulls last,
    case when p_sort = 'accuracy' and p_direction = 'desc' then accuracy end desc nulls last,
    case when p_sort = 'accuracy' and p_direction = 'asc' then accuracy end asc nulls last,
    case when p_sort = 'lastPlayedAt' and p_direction = 'asc' then last_played_at end asc nulls last,
    last_played_at desc nulls last,
    username asc
  limit least(greatest(p_page_size, 1), 100)
  offset (greatest(p_page, 1) - 1) * least(greatest(p_page_size, 1), 100)
)
select jsonb_build_object(
  'total', coalesce((select max(total) from counted), 0),
  'players', coalesce((select jsonb_agg(jsonb_build_object(
    'id', id,
    'username', username,
    'level', level,
    'rankTitle', rank_title,
    'totalPoints', total_points,
    'pointsBalance', points_balance,
    'rating', rating,
    'profileWins', profile_wins,
    'profileLosses', profile_losses,
    'battlesPlayed', battles_played,
    'pvpBattles', pvp_battles,
    'botBattles', bot_battles,
    'practiceBattles', practice_battles,
    'answers', answers,
    'accuracy', accuracy,
    'avgResponseMs', avg_response_ms,
    'flaggedAnswers', flagged_answers,
    'cardsOwned', cards_owned,
    'lastPlayedAt', last_played_at
  )) from paged), '[]'::jsonb)
);
$$;

revoke all on function public.get_admin_dashboard_players(text, boolean, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_admin_dashboard_players(text, boolean, text, text, integer, integer) to service_role;
