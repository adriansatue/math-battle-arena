-- ============================================================================
-- DIAGNOSTIC QUERIES TO CHECK USER POINTS CALCULATIONS
-- ============================================================================

-- 1. ALL-TIME POINTS SUMMARY FOR ALL USERS
-- Shows what's stored vs what should be calculated from battles
SELECT 
  p.id,
  p.username,
  p.total_points AS profile_total_points,
  COALESCE(SUM(ba.points_earned), 0) AS sum_all_answers,
  COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) * 200 AS winner_bonuses,
  COALESCE(SUM(ba.points_earned), 0) + (COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) * 200) AS calculated_total,
  COUNT(DISTINCT ba.battle_id) AS battles_participated,
  COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) AS battles_won
FROM profiles p
LEFT JOIN battle_answers ba ON ba.player_id = p.id
LEFT JOIN battles b ON b.id = ba.battle_id AND b.status = 'finished'
WHERE p.rank_title != 'AI Challenger' AND p.username NOT ILIKE '%MathBot%'
GROUP BY p.id, p.username, p.total_points
ORDER BY p.total_points DESC;

-- 2. THIS WEEK'S POINTS SUMMARY (Last 7 days)
SELECT 
  p.id,
  p.username,
  p.total_points AS all_time_points,
  COALESCE(SUM(ba.points_earned), 0) AS weekly_answer_points,
  COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) * 200 AS weekly_winner_bonuses,
  COALESCE(SUM(ba.points_earned), 0) + (COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) * 200) AS weekly_total,
  COUNT(DISTINCT ba.battle_id) AS weekly_battles_played,
  COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) AS weekly_battles_won
FROM profiles p
LEFT JOIN battle_answers ba ON ba.player_id = p.id
LEFT JOIN battles b ON b.id = ba.battle_id 
  AND b.status = 'finished' 
  AND b.finished_at >= NOW() - INTERVAL '7 days'
WHERE p.rank_title != 'AI Challenger' AND p.username NOT ILIKE '%MathBot%'
GROUP BY p.id, p.username, p.total_points
ORDER BY weekly_total DESC;

-- 3. SPECIFIC USER DETAIL - ALL TIME & THIS WEEK
SELECT 
  'Adrian' as user_check,
  p.id,
  p.username,
  p.total_points,
  (
    SELECT COALESCE(SUM(ba.points_earned), 0)
    FROM battle_answers ba
    WHERE ba.player_id = p.id
  ) as all_time_answer_points,
  (
    SELECT COUNT(*) * 200
    FROM battles b
    WHERE b.winner_id = p.id AND b.status = 'finished'
  ) as all_time_winner_bonuses,
  (
    SELECT COALESCE(SUM(ba.points_earned), 0)
    FROM battle_answers ba
    JOIN battles b ON b.id = ba.battle_id
    WHERE ba.player_id = p.id 
      AND b.finished_at >= NOW() - INTERVAL '7 days'
  ) as weekly_answer_points,
  (
    SELECT COUNT(*) * 200
    FROM battles b
    WHERE b.winner_id = p.id 
      AND b.status = 'finished'
      AND b.finished_at >= NOW() - INTERVAL '7 days'
  ) as weekly_winner_bonuses
FROM profiles p
WHERE p.username = 'Adrian';

-- 4. DASAFA DETAIL - ALL TIME & THIS WEEK  
SELECT 
  'dasafa' as user_check,
  p.id,
  p.username,
  p.total_points,
  (
    SELECT COALESCE(SUM(ba.points_earned), 0)
    FROM battle_answers ba
    WHERE ba.player_id = p.id
  ) as all_time_answer_points,
  (
    SELECT COUNT(*) * 200
    FROM battles b
    WHERE b.winner_id = p.id AND b.status = 'finished'
  ) as all_time_winner_bonuses,
  (
    SELECT COALESCE(SUM(ba.points_earned), 0)
    FROM battle_answers ba
    JOIN battles b ON b.id = ba.battle_id
    WHERE ba.player_id = p.id 
      AND b.finished_at >= NOW() - INTERVAL '7 days'
  ) as weekly_answer_points,
  (
    SELECT COUNT(*) * 200
    FROM battles b
    WHERE b.winner_id = p.id 
      AND b.status = 'finished'
      AND b.finished_at >= NOW() - INTERVAL '7 days'
  ) as weekly_winner_bonuses
FROM profiles p
WHERE p.username = 'dasafa';

-- 5. BATTLES FROM LAST 7 DAYS WITH PARTICIPANTS
SELECT 
  b.id,
  b.created_at,
  b.finished_at,
  b.status,
  b.host_id,
  b.guest_id,
  b.winner_id,
  ph.username as host_username,
  pg.username as guest_username,
  pw.username as winner_username,
  b.host_score,
  b.guest_score
FROM battles b
LEFT JOIN profiles ph ON ph.id = b.host_id
LEFT JOIN profiles pg ON pg.id = b.guest_id
LEFT JOIN profiles pw ON pw.id = b.winner_id
WHERE b.finished_at >= NOW() - INTERVAL '7 days'
ORDER BY b.finished_at DESC;

-- 6. CHECK FOR DATA INCONSISTENCIES - Users where weekly > all-time (SHOULDN'T EXIST)
SELECT 
  p.id,
  p.username,
  p.total_points as all_time,
  (
    SELECT COALESCE(SUM(ba.points_earned), 0)
    FROM battle_answers ba
    JOIN battles b ON b.id = ba.battle_id
    WHERE ba.player_id = p.id 
      AND b.finished_at >= NOW() - INTERVAL '7 days'
  ) +
  (
    SELECT COUNT(*) * 200
    FROM battles b
    WHERE b.winner_id = p.id 
      AND b.status = 'finished'
      AND b.finished_at >= NOW() - INTERVAL '7 days'
  ) as weekly_calculated
FROM profiles p
WHERE p.rank_title != 'AI Challenger' AND p.username NOT ILIKE '%MathBot%'
HAVING (
  SELECT COALESCE(SUM(ba.points_earned), 0)
  FROM battle_answers ba
  JOIN battles b ON b.id = ba.battle_id
  WHERE ba.player_id = p.id 
    AND b.finished_at >= NOW() - INTERVAL '7 days'
) +
(
  SELECT COUNT(*) * 200
  FROM battles b
  WHERE b.winner_id = p.id 
    AND b.status = 'finished'
    AND b.finished_at >= NOW() - INTERVAL '7 days'
) > p.total_points
ORDER BY p.total_points DESC;

-- 7. BATTLES WITH TIMESTAMP ISSUES (finished_at before created_at)
SELECT 
  b.id,
  b.created_at,
  b.finished_at,
  b.status,
  EXTRACT(EPOCH FROM (b.finished_at - b.created_at)) / 3600 as hours_duration
FROM battles b
WHERE b.finished_at < b.created_at
   OR b.finished_at IS NULL
ORDER BY b.created_at DESC;

-- ============================================================================
-- PHASE 0: FIRST-PARTY PRODUCT FUNNEL AND RETENTION
-- Excludes bot profiles. Add other known test-account IDs to excluded_users.
-- ============================================================================

-- 8. CORE FUNNEL, UNIQUE PLAYERS IN THE LAST 14 DAYS
WITH excluded_users AS (
  SELECT id
  FROM profiles
  WHERE rank_title = 'AI Challenger' OR username ILIKE '%MathBot%'
), funnel_steps(event_name, step_order) AS (
  VALUES
    ('account_started', 1),
    ('lobby_viewed', 2),
    ('matchmaking_started', 3),
    ('match_found', 4),
    ('battle_started', 5),
    ('battle_finished', 6),
    ('results_viewed', 7)
), counts AS (
  SELECT event_name, COUNT(DISTINCT user_id) AS players
  FROM product_events
  WHERE occurred_at >= NOW() - INTERVAL '14 days'
    AND user_id NOT IN (SELECT id FROM excluded_users)
  GROUP BY event_name
)
SELECT
  fs.step_order,
  fs.event_name,
  COALESCE(c.players, 0) AS players,
  ROUND(
    100.0 * COALESCE(c.players, 0)
    / NULLIF(FIRST_VALUE(COALESCE(c.players, 0)) OVER (ORDER BY fs.step_order), 0),
    1
  ) AS percent_of_first_step
FROM funnel_steps fs
LEFT JOIN counts c USING (event_name)
ORDER BY fs.step_order;

-- 9. STARTED BATTLE COMPLETION RATE AND BATTLES PER SESSION, LAST 14 DAYS
WITH eligible_events AS (
  SELECT pe.*
  FROM product_events pe
  LEFT JOIN profiles p ON p.id = pe.user_id
  WHERE pe.occurred_at >= NOW() - INTERVAL '14 days'
    AND COALESCE(p.rank_title, '') != 'AI Challenger'
    AND COALESCE(p.username, '') NOT ILIKE '%MathBot%'
), battle_activity AS (
  SELECT
    user_id,
    battle_id,
    occurred_at,
    CASE
      WHEN occurred_at - LAG(occurred_at) OVER (PARTITION BY user_id ORDER BY occurred_at) > INTERVAL '30 minutes'
        OR LAG(occurred_at) OVER (PARTITION BY user_id ORDER BY occurred_at) IS NULL
      THEN 1 ELSE 0
    END AS starts_session
  FROM eligible_events
  WHERE event_name = 'battle_started'
), sessionized AS (
  SELECT
    *,
    SUM(starts_session) OVER (PARTITION BY user_id ORDER BY occurred_at) AS inferred_session
  FROM battle_activity
), session_counts AS (
  SELECT user_id, inferred_session, COUNT(DISTINCT battle_id) AS battles
  FROM sessionized
  GROUP BY user_id, inferred_session
)
SELECT
  COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'battle_started') AS battles_started,
  COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'battle_finished') AS battles_finished,
  ROUND(
    100.0 * COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'battle_finished')
    / NULLIF(COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'battle_started'), 0),
    1
  ) AS completion_rate_percent,
  (SELECT ROUND(AVG(battles), 2) FROM session_counts) AS avg_battles_per_inferred_session
FROM eligible_events;

-- 10. RESULTS ENGAGEMENT RATES, LAST 14 DAYS
WITH per_battle AS (
  SELECT
    user_id,
    battle_id,
    BOOL_OR(event_name = 'results_viewed') AS viewed_results,
    BOOL_OR(event_name = 'answer_review_opened') AS opened_review
  FROM product_events
  WHERE occurred_at >= NOW() - INTERVAL '14 days'
    AND event_name IN ('results_viewed', 'answer_review_opened')
  GROUP BY user_id, battle_id
)
SELECT
  COUNT(*) FILTER (WHERE viewed_results) AS results_views,
  COUNT(*) FILTER (WHERE opened_review) AS review_opens,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE opened_review)
    / NULLIF(COUNT(*) FILTER (WHERE viewed_results), 0),
    1
  ) AS answer_review_open_rate_percent
FROM per_battle;

-- 11. NEXT-DAY AND SEVEN-DAY RETURN BY FIRST OBSERVED ACTIVE DATE
WITH active_days AS (
  SELECT DISTINCT user_id, occurred_at::date AS active_date
  FROM product_events
  WHERE event_name IN ('lobby_viewed', 'battle_started', 'practice_started')
), cohorts AS (
  SELECT user_id, MIN(active_date) AS cohort_date
  FROM active_days
  GROUP BY user_id
), mature_cohorts AS (
  SELECT * FROM cohorts WHERE cohort_date <= CURRENT_DATE - 7
)
SELECT
  cohort_date,
  COUNT(*) AS new_players,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM active_days ad
      WHERE ad.user_id = mc.user_id AND ad.active_date = mc.cohort_date + 1
    )
  ) / NULLIF(COUNT(*), 0), 1) AS next_day_return_percent,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE EXISTS (
      SELECT 1 FROM active_days ad
      WHERE ad.user_id = mc.user_id AND ad.active_date = mc.cohort_date + 7
    )
  ) / NULLIF(COUNT(*), 0), 1) AS day_7_return_percent
FROM mature_cohorts mc
GROUP BY cohort_date
ORDER BY cohort_date DESC;

-- 12. PRACTICE WITHIN 24 HOURS AFTER VIEWING A PROFILE INSIGHT
WITH insight_views AS (
  SELECT user_id, occurred_at
  FROM product_events
  WHERE event_name = 'profile_insight_viewed'
    AND occurred_at >= NOW() - INTERVAL '14 days'
)
SELECT
  COUNT(*) AS insight_views,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1
    FROM product_events practice
    WHERE practice.user_id = insight_views.user_id
      AND practice.event_name = 'practice_started'
      AND practice.occurred_at > insight_views.occurred_at
      AND practice.occurred_at <= insight_views.occurred_at + INTERVAL '24 hours'
  )) AS followed_by_practice,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1
    FROM product_events practice
    WHERE practice.user_id = insight_views.user_id
      AND practice.event_name = 'practice_started'
      AND practice.occurred_at > insight_views.occurred_at
      AND practice.occurred_at <= insight_views.occurred_at + INTERVAL '24 hours'
  )) / NULLIF(COUNT(*), 0), 1) AS practice_after_insight_percent
FROM insight_views;

-- 13. MATCHMAKING ABANDONMENT: QUEUED ATTEMPTS WITHOUT A MATCH WITHIN 10 MINUTES
WITH queued AS (
  SELECT user_id, occurred_at
  FROM product_events
  WHERE event_name = 'matchmaking_started'
    AND properties->>'queued' = 'true'
    AND occurred_at >= NOW() - INTERVAL '14 days'
)
SELECT
  COUNT(*) AS queued_attempts,
  COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1
    FROM product_events matched
    WHERE matched.user_id = queued.user_id
      AND matched.event_name IN ('match_found', 'bot_fallback_started')
      AND matched.occurred_at >= queued.occurred_at
      AND matched.occurred_at <= queued.occurred_at + INTERVAL '10 minutes'
  )) AS abandoned_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE NOT EXISTS (
    SELECT 1
    FROM product_events matched
    WHERE matched.user_id = queued.user_id
      AND matched.event_name IN ('match_found', 'bot_fallback_started')
      AND matched.occurred_at >= queued.occurred_at
      AND matched.occurred_at <= queued.occurred_at + INTERVAL '10 minutes'
  )) / NULLIF(COUNT(*), 0), 1) AS abandonment_rate_percent
FROM queued;

-- 14. PLAY AGAIN AND GUEST-UPGRADE RATES, LAST 14 DAYS
SELECT
  COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'results_viewed') AS viewed_results,
  COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'play_again_clicked') AS play_again_clicks,
  ROUND(
    100.0 * COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'play_again_clicked')
    / NULLIF(COUNT(DISTINCT battle_id) FILTER (WHERE event_name = 'results_viewed'), 0),
    1
  ) AS play_again_rate_percent,
  COUNT(DISTINCT user_id) FILTER (
    WHERE event_name = 'account_started' AND properties->>'account_type' = 'anonymous'
  ) AS guest_accounts_started,
  COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'guest_upgraded') AS guests_upgraded,
  ROUND(
    100.0 * COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'guest_upgraded')
    / NULLIF(COUNT(DISTINCT user_id) FILTER (
      WHERE event_name = 'account_started' AND properties->>'account_type' = 'anonymous'
    ), 0),
    1
  ) AS guest_upgrade_rate_percent
FROM product_events
WHERE occurred_at >= NOW() - INTERVAL '14 days';

-- Recommended-practice and true rematch rates remain unavailable until those
-- product actions exist; Play Again intentionally remains a separate event.

-- 15. NEW ACCOUNTS THAT START A FIRST BATTLE WITHIN 24 HOURS, LAST 14 DAYS
WITH new_accounts AS (
  SELECT user_id, MIN(occurred_at) AS started_at
  FROM product_events
  WHERE event_name = 'account_started'
    AND occurred_at >= NOW() - INTERVAL '14 days'
  GROUP BY user_id
)
SELECT
  COUNT(*) AS new_accounts,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1
    FROM product_events battle
    WHERE battle.user_id = new_accounts.user_id
      AND battle.event_name = 'battle_started'
      AND battle.occurred_at >= new_accounts.started_at
      AND battle.occurred_at <= new_accounts.started_at + INTERVAL '24 hours'
  )) AS started_first_battle,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1
    FROM product_events battle
    WHERE battle.user_id = new_accounts.user_id
      AND battle.event_name = 'battle_started'
      AND battle.occurred_at >= new_accounts.started_at
      AND battle.occurred_at <= new_accounts.started_at + INTERVAL '24 hours'
  )) / NULLIF(COUNT(*), 0), 1) AS first_battle_within_24h_percent
FROM new_accounts;

-- ============================================================================
-- PHASE 2: FOCUSED PRACTICE AND IMPROVEMENT
-- Baseline: latest 20 unflagged answers in the same topic before each session.
-- ============================================================================

-- 16. RECOMMENDATION-TO-PRACTICE CONVERSION AND COMPLETION, LAST 14 DAYS
WITH recommendations AS (
  SELECT user_id, occurred_at, properties->>'topic' AS topic
  FROM product_events
  WHERE event_name = 'recommended_practice_clicked'
    AND occurred_at >= NOW() - INTERVAL '14 days'
), converted AS (
  SELECT
    recommendation.*,
    (
      SELECT ps.battle_id
      FROM practice_sessions ps
      WHERE ps.user_id = recommendation.user_id
        AND ps.topic = recommendation.topic
        AND ps.created_at >= recommendation.occurred_at
        AND ps.created_at <= recommendation.occurred_at + INTERVAL '30 minutes'
      ORDER BY ps.created_at
      LIMIT 1
    ) AS practice_battle_id
  FROM recommendations recommendation
)
SELECT
  COUNT(*) AS recommendation_clicks,
  COUNT(practice_battle_id) AS practice_starts,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM practice_sessions ps
    WHERE ps.battle_id = converted.practice_battle_id AND ps.completed_at IS NOT NULL
  )) AS practice_completions,
  ROUND(100.0 * COUNT(practice_battle_id) / NULLIF(COUNT(*), 0), 1) AS start_rate_percent,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM practice_sessions ps
    WHERE ps.battle_id = converted.practice_battle_id AND ps.completed_at IS NOT NULL
  )) / NULLIF(COUNT(practice_battle_id), 0), 1) AS completion_rate_percent
FROM converted;

-- 17. FOCUSED PRACTICE ACCURACY CHANGE AND REPEAT RATE, LAST 14 DAYS
SELECT
  topic,
  COUNT(*) AS completed_sessions,
  ROUND(AVG(100.0 * session_correct / NULLIF(session_attempts, 0)), 1) AS session_accuracy_percent,
  ROUND(AVG(
    100.0 * session_correct / NULLIF(session_attempts, 0)
    - 100.0 * baseline_correct / NULLIF(baseline_attempts, 0)
  ) FILTER (WHERE baseline_attempts >= 5 AND session_attempts >= 5), 1) AS avg_accuracy_change_points,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM practice_sessions repeated
    WHERE repeated.user_id = practice_sessions.user_id
      AND repeated.topic = practice_sessions.topic
      AND repeated.created_at > practice_sessions.completed_at
      AND repeated.created_at <= practice_sessions.completed_at + INTERVAL '24 hours'
  )) / NULLIF(COUNT(*), 0), 1) AS repeat_within_24h_percent
FROM practice_sessions
WHERE completed_at >= NOW() - INTERVAL '14 days'
GROUP BY topic
ORDER BY completed_sessions DESC;

-- 18. RETURN TO BATTLE AFTER FOCUSED PRACTICE, LAST 14 DAYS
SELECT
  COUNT(*) AS completed_practice_sessions,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1
    FROM battles battle
    WHERE (battle.host_id = ps.user_id OR battle.guest_id = ps.user_id)
      AND battle.guest_id IS NOT NULL
      AND battle.started_at > ps.completed_at
      AND battle.started_at <= ps.completed_at + INTERVAL '24 hours'
  )) AS battled_within_24h,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1
    FROM battles battle
    WHERE (battle.host_id = ps.user_id OR battle.guest_id = ps.user_id)
      AND battle.guest_id IS NOT NULL
      AND battle.started_at > ps.completed_at
      AND battle.started_at <= ps.completed_at + INTERVAL '24 hours'
  )) / NULLIF(COUNT(*), 0), 1) AS battle_return_rate_percent
FROM practice_sessions ps
WHERE ps.completed_at >= NOW() - INTERVAL '14 days';

-- 19. LATER BATTLE IMPROVEMENT IN THE PRACTISED TOPIC
WITH later_battle_answers AS (
  SELECT
    ps.battle_id AS practice_battle_id,
    ps.user_id,
    ps.topic,
    ps.baseline_attempts,
    ps.baseline_correct,
    COUNT(*) AS later_attempts,
    COUNT(*) FILTER (WHERE ba.is_correct) AS later_correct
  FROM practice_sessions ps
  JOIN battles battle
    ON (battle.host_id = ps.user_id OR battle.guest_id = ps.user_id)
   AND battle.guest_id IS NOT NULL
   AND battle.started_at > ps.completed_at
   AND battle.started_at <= ps.completed_at + INTERVAL '7 days'
  JOIN battle_answers ba ON ba.battle_id = battle.id AND ba.player_id = ps.user_id
  JOIN battle_questions bq ON bq.id = ba.question_id AND bq.category = ps.topic
  WHERE ps.completed_at >= NOW() - INTERVAL '21 days'
    AND ps.baseline_attempts >= 5
    AND COALESCE(ba.flagged, false) = false
  GROUP BY ps.battle_id, ps.user_id, ps.topic, ps.baseline_attempts, ps.baseline_correct
)
SELECT
  COUNT(*) AS practices_with_later_topic_evidence,
  COUNT(*) FILTER (WHERE
    later_attempts >= 3
    AND later_correct::numeric / later_attempts
      > baseline_correct::numeric / baseline_attempts
  ) AS later_improved,
  ROUND(100.0 * COUNT(*) FILTER (WHERE
    later_attempts >= 3
    AND later_correct::numeric / later_attempts
      > baseline_correct::numeric / baseline_attempts
  ) / NULLIF(COUNT(*) FILTER (WHERE later_attempts >= 3), 0), 1) AS later_improvement_percent
FROM later_battle_answers;

-- ============================================================================
-- PHASE 4: DAILY OBJECTIVES AND ACTIVITY STREAKS
-- Dates and week boundaries use UTC, matching the product reset contract.
-- ============================================================================

-- 20. OBJECTIVE VIEW, COMPLETION, AND CLAIM FUNNEL, LAST 14 UTC DAYS
WITH objective_days AS (
  SELECT
    user_id,
    objective_date,
    BOOL_OR(completed_at IS NOT NULL) AS completed_any,
    BOOL_OR(claimed_at IS NOT NULL) AS claimed_any
  FROM daily_objective_progress
  WHERE objective_date >= (NOW() AT TIME ZONE 'UTC')::date - 13
  GROUP BY user_id, objective_date
), viewed_days AS (
  SELECT DISTINCT user_id, (occurred_at AT TIME ZONE 'UTC')::date AS objective_date
  FROM product_events
  WHERE event_name = 'daily_objectives_viewed'
    AND occurred_at >= NOW() - INTERVAL '14 days'
)
SELECT
  COUNT(*) AS generated_player_days,
  COUNT(*) FILTER (WHERE viewed_days.user_id IS NOT NULL) AS viewed_player_days,
  COUNT(*) FILTER (WHERE completed_any) AS completed_player_days,
  COUNT(*) FILTER (WHERE claimed_any) AS claimed_player_days,
  ROUND(100.0 * COUNT(*) FILTER (WHERE completed_any) / NULLIF(COUNT(*), 0), 1) AS completion_rate_percent,
  ROUND(100.0 * COUNT(*) FILTER (WHERE claimed_any) / NULLIF(COUNT(*) FILTER (WHERE completed_any), 0), 1) AS claim_rate_percent
FROM objective_days
LEFT JOIN viewed_days USING (user_id, objective_date);

-- 21. COMPLETION SPEED AND PARTIAL ABANDONMENT BY OBJECTIVE, LAST 14 UTC DAYS
SELECT
  objective_key,
  COUNT(*) AS generated,
  COUNT(*) FILTER (WHERE completed_at IS NOT NULL) AS completed,
  ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60)
    FILTER (WHERE completed_at IS NOT NULL), 1) AS avg_minutes_to_complete,
  COUNT(*) FILTER (WHERE progress > 0 AND completed_at IS NULL) AS started_not_completed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE progress > 0 AND completed_at IS NULL)
    / NULLIF(COUNT(*) FILTER (WHERE progress > 0), 0), 1) AS partial_abandonment_percent
FROM daily_objective_progress
WHERE objective_date >= (NOW() AT TIME ZONE 'UTC')::date - 13
GROUP BY objective_key
ORDER BY objective_key;

-- 22. NEXT-DAY RETURN AMONG PLAYERS WHO COMPLETED ANY OBJECTIVE
WITH completion_days AS (
  SELECT DISTINCT user_id, objective_date
  FROM daily_objective_progress
  WHERE completed_at IS NOT NULL
    AND objective_date >= (NOW() AT TIME ZONE 'UTC')::date - 14
    AND objective_date < (NOW() AT TIME ZONE 'UTC')::date
)
SELECT
  COUNT(*) AS objective_completion_days,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM user_activity_days next_day
    WHERE next_day.user_id = completion_days.user_id
      AND next_day.activity_date = completion_days.objective_date + 1
  )) AS returned_next_day,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM user_activity_days next_day
    WHERE next_day.user_id = completion_days.user_id
      AND next_day.activity_date = completion_days.objective_date + 1
  )) / NULLIF(COUNT(*), 0), 1) AS next_day_return_percent
FROM completion_days;

-- 23. DAILY OBJECTIVE REWARD INFLATION, LAST 14 UTC DAYS
SELECT
  objective_date,
  COUNT(*) FILTER (WHERE claimed_at IS NOT NULL) AS rewards_claimed,
  COALESCE(SUM(reward_coins) FILTER (WHERE claimed_at IS NOT NULL), 0) AS coins_issued,
  ROUND(COALESCE(SUM(reward_coins) FILTER (WHERE claimed_at IS NOT NULL), 0)::numeric
    / NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE claimed_at IS NOT NULL), 0), 1) AS coins_per_claiming_player
FROM daily_objective_progress
WHERE objective_date >= (NOW() AT TIME ZONE 'UTC')::date - 13
GROUP BY objective_date
ORDER BY objective_date DESC;

-- 24. DISTRIBUTION OF COMPLETED CONSECUTIVE DAY AND WEEK RUNS
WITH day_groups AS (
  SELECT
    user_id,
    activity_date,
    activity_date - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY activity_date)::integer AS run_group
  FROM user_activity_days
), day_runs AS (
  SELECT user_id, COUNT(*)::integer AS run_length
  FROM day_groups
  GROUP BY user_id, run_group
), weeks AS (
  SELECT DISTINCT
    user_id,
    activity_date - (EXTRACT(ISODOW FROM activity_date)::integer - 1) AS week_start
  FROM user_activity_days
), week_groups AS (
  SELECT
    user_id,
    week_start,
    week_start - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY week_start)::integer * 7 AS run_group
  FROM weeks
), week_runs AS (
  SELECT user_id, COUNT(*)::integer AS run_length
  FROM week_groups
  GROUP BY user_id, run_group
), combined AS (
  SELECT 'day' AS period, run_length FROM day_runs
  UNION ALL
  SELECT 'week' AS period, run_length FROM week_runs
)
SELECT period, run_length, COUNT(*) AS player_runs
FROM combined
GROUP BY period, run_length
ORDER BY period, run_length;

-- ============================================================================
-- PHASE 5: WEEKLY COMPETITION
-- ============================================================================

-- 25. WEEKLY PARTICIPATION AND SUMMARY VIEW RATE BY UTC WEEK
SELECT
  entries.week_start,
  COUNT(DISTINCT entries.user_id) AS participants,
  COUNT(DISTINCT views.user_id) AS summary_viewers,
  ROUND(100.0 * COUNT(DISTINCT views.user_id) / NULLIF(COUNT(DISTINCT entries.user_id), 0), 1) AS summary_view_rate_percent,
  ROUND(AVG(entries.battles_completed), 1) AS avg_pvp_battles,
  ROUND(AVG(entries.xp_earned), 1) AS avg_weekly_xp
FROM weekly_competition_entries entries
LEFT JOIN product_events views
  ON views.user_id = entries.user_id
 AND views.event_name = 'weekly_summary_viewed'
 AND (views.occurred_at AT TIME ZONE 'UTC')::date BETWEEN entries.week_start AND entries.week_start + 6
GROUP BY entries.week_start
ORDER BY entries.week_start DESC;

-- 26. SEVEN-DAY RETURN AFTER WEEKLY PARTICIPATION
SELECT
  COUNT(*) AS participants,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM user_activity_days activity
    WHERE activity.user_id = entries.user_id
      AND activity.activity_date BETWEEN entries.week_start + 7 AND entries.week_start + 13
  )) AS returned_next_week,
  ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM user_activity_days activity
    WHERE activity.user_id = entries.user_id
      AND activity.activity_date BETWEEN entries.week_start + 7 AND entries.week_start + 13
  )) / NULLIF(COUNT(*), 0), 1) AS next_week_return_percent
FROM weekly_competition_entries entries
WHERE entries.week_start < (NOW() AT TIME ZONE 'UTC')::date - 13;

-- 27. WEEKLY REWARD DISTRIBUTION BY DIVISION
SELECT
  week_start,
  division,
  COUNT(*) AS claims,
  SUM(reward_coins) AS coins_issued,
  ROUND(AVG(reward_coins), 1) AS avg_reward,
  MIN(final_rank) AS best_claimed_rank,
  MAX(final_rank) AS lowest_claimed_rank
FROM weekly_reward_claims
GROUP BY week_start, division
ORDER BY week_start DESC, division;

-- ============================================================================
-- PHASE 6: COLLECTION WITH PURPOSE
-- ============================================================================

-- 28. COLLECTION COMPLETION AND DUPLICATE DISTRIBUTION
WITH inventory AS (
  SELECT inventory.user_id, COUNT(*) AS cards, COUNT(DISTINCT LOWER(TRIM(catalog.name))) AS unique_cards
  FROM user_inventory inventory
  JOIN reward_catalog catalog ON catalog.id = inventory.reward_id
  GROUP BY inventory.user_id
), catalog AS (
  SELECT COUNT(DISTINCT LOWER(TRIM(name))) AS total_cards FROM reward_catalog WHERE is_active
)
SELECT
  COUNT(*) AS collectors,
  ROUND(AVG(unique_cards), 1) AS avg_unique_cards,
  ROUND(AVG(cards - unique_cards), 1) AS avg_duplicates,
  COUNT(*) FILTER (WHERE unique_cards = catalog.total_cards) AS completed_catalogs,
  ROUND(100.0 * COUNT(*) FILTER (WHERE unique_cards = catalog.total_cards) / NULLIF(COUNT(*), 0), 1) AS completion_rate_percent
FROM inventory CROSS JOIN catalog;

-- 29. PACK AFFORDABILITY AND ACTIVE GOAL DISTRIBUTION
SELECT
  preferences.selected_pack_type,
  COUNT(*) AS players,
  ROUND(AVG(GREATEST(0, CASE preferences.selected_pack_type
    WHEN 'basic' THEN 300 WHEN 'rare' THEN 900 ELSE 1800 END
    - COALESCE(profiles.points_balance, profiles.total_points, 0))), 1) AS avg_coins_remaining,
  COUNT(*) FILTER (WHERE COALESCE(profiles.points_balance, profiles.total_points, 0) >= CASE preferences.selected_pack_type
    WHEN 'basic' THEN 300 WHEN 'rare' THEN 900 ELSE 1800 END) AS can_afford_goal
FROM collection_preferences preferences
JOIN profiles ON profiles.id = preferences.user_id
GROUP BY preferences.selected_pack_type;

-- 30. PACK DUPLICATE REFUNDS AND NET COIN SINK, LAST 30 DAYS
SELECT
  pack_type,
  COUNT(*) AS packs_opened,
  SUM(duplicate_count) AS duplicates,
  ROUND(100.0 * SUM(duplicate_count) / NULLIF(COUNT(*) * 3, 0), 1) AS duplicate_rate_percent,
  SUM(gross_cost) AS gross_cost,
  SUM(duplicate_refund) AS refunded,
  SUM(net_cost) AS net_coin_sink
FROM pack_opening_receipts
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY pack_type
ORDER BY pack_type;
