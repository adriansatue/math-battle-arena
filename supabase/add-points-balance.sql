-- Split total_points (leaderboard, lifetime earned) from points_balance (spendable wallet)
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

-- Step 1: add the spendable balance column, seeded from current total_points
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS points_balance integer NOT NULL DEFAULT 0;

-- Step 2: seed balance = current total_points for all existing users
UPDATE profiles SET points_balance = total_points;
