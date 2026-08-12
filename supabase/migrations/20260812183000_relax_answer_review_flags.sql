-- The old review rule was too aggressive and marked very fast but plausible
-- answers. Keep review flags for correct answers that are still highly
-- suspicious under the new thresholds.

update public.battle_answers
set flagged = false
where flagged = true
  and (
    is_correct = false
    or (
      coalesce(time_taken_ms, 0) >= 100
      and coalesce(server_validated_ms, 0) >= 100
      and coalesce(server_validated_ms, 0) <= coalesce(time_taken_ms, 0) + 5000
    )
  );
