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
