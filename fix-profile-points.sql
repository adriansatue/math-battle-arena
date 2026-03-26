-- ============================================================================
-- FIX SCRIPT: RECALCULATE AND CORRECT ALL PROFILE POINTS
-- ============================================================================
-- This script repairs profile.total_points to match actual battle results

-- BACKUP: Create a snapshot of current data (for safety)
-- Run this FIRST to have a backup if needed
CREATE TABLE IF NOT EXISTS profiles_backup_before_fix AS
SELECT * FROM profiles WHERE rank_title != 'AI Challenger';

-- VIEW: Calculate correct points for each user
-- Use this to verify the calculations before applying
CREATE OR REPLACE VIEW correct_profile_points AS
SELECT 
  p.id,
  p.username,
  -- Sum all answer points from finished battles
  COALESCE(SUM(ba.points_earned), 0) as answer_points_total,
  -- Add 200 per battle won
  COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) * 200 as winner_bonus_total,
  -- Calculate the correct total
  COALESCE(SUM(ba.points_earned), 0) + 
  (COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) * 200) as correct_total_points,
  -- Current (wrong) values
  p.total_points as current_stored_points,
  p.points_balance as current_stored_balance,
  -- Calculate the difference
  COALESCE(SUM(ba.points_earned), 0) + 
  (COUNT(DISTINCT CASE WHEN b.winner_id = p.id THEN b.id END) * 200) - 
  p.total_points as points_difference
FROM profiles p
LEFT JOIN battle_answers ba ON ba.player_id = p.id
LEFT JOIN battles b ON b.id = ba.battle_id AND b.status = 'finished'
WHERE p.rank_title != 'AI Challenger' AND p.username NOT ILIKE '%MathBot%'
GROUP BY p.id, p.username, p.total_points, p.points_balance;

-- VERIFY: Show what will be fixed (RUN THIS FIRST TO CHECK)
SELECT 
  username,
  current_stored_points,
  correct_total_points,
  points_difference,
  CASE 
    WHEN points_difference > 0 THEN 'MISSING ' || points_difference || ' PTS'
    WHEN points_difference < 0 THEN 'OVER BY ' || ABS(points_difference) || ' PTS'
    ELSE 'CORRECT'
  END as status
FROM correct_profile_points
WHERE points_difference != 0
ORDER BY ABS(points_difference) DESC;

-- ============================================================================
-- EXECUTE FIX: Update all profiles to correct values
-- ============================================================================
-- ONLY RUN THIS AFTER VERIFYING THE ABOVE LOOKS CORRECT!

UPDATE profiles p
SET 
  total_points = cpp.correct_total_points,
  points_balance = cpp.correct_total_points,
  -- Recalculate level based on corrected points
  level = CASE
    WHEN cpp.correct_total_points >= 35000 THEN 8
    WHEN cpp.correct_total_points >= 20000 THEN 7
    WHEN cpp.correct_total_points >= 12000 THEN 6
    WHEN cpp.correct_total_points >= 7000 THEN 5
    WHEN cpp.correct_total_points >= 3500 THEN 4
    WHEN cpp.correct_total_points >= 1500 THEN 3
    WHEN cpp.correct_total_points >= 500 THEN 2
    ELSE 1
  END,
  rank_title = CASE
    WHEN cpp.correct_total_points >= 35000 THEN 'Grand Mathematician'
    WHEN cpp.correct_total_points >= 20000 THEN 'Math Prodigy'
    WHEN cpp.correct_total_points >= 12000 THEN 'Algebra Champion'
    WHEN cpp.correct_total_points >= 7000 THEN 'Calc Wizard'
    WHEN cpp.correct_total_points >= 3500 THEN 'Formula Master'
    WHEN cpp.correct_total_points >= 1500 THEN 'Equation Solver'
    WHEN cpp.correct_total_points >= 500 THEN 'Number Cruncher'
    ELSE 'Math Rookie'
  END
FROM correct_profile_points cpp
WHERE p.id = cpp.id
  AND p.rank_title != 'AI Challenger'
  AND cpp.points_difference != 0;

-- VERIFY: Run this to confirm the fix worked
SELECT 
  username,
  current_stored_points as old_points,
  correct_total_points as new_points,
  points_difference as difference
FROM correct_profile_points
WHERE points_difference != 0
ORDER BY ABS(points_difference) DESC;

-- Cleanup: Drop the view (optional)
-- DROP VIEW IF EXISTS correct_profile_points;
