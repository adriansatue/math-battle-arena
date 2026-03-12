-- Add TAG grading scale (5–10) to user_inventory
-- Run in: Supabase Dashboard → SQL Editor → New Query → Run

ALTER TABLE user_inventory
  ADD COLUMN IF NOT EXISTS grade smallint
    CHECK (grade BETWEEN 5 AND 10);
