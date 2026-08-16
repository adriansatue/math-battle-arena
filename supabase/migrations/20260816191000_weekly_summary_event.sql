alter table public.product_events
  drop constraint if exists product_events_event_name_check;

alter table public.product_events
  add constraint product_events_event_name_check check (event_name in (
    'account_started', 'guest_upgraded', 'lobby_viewed', 'matchmaking_started',
    'match_found', 'bot_fallback_started', 'battle_started', 'battle_finished',
    'results_viewed', 'answer_review_opened', 'play_again_clicked',
    'recommended_practice_clicked', 'practice_started', 'practice_finished',
    'rematch_requested', 'rematch_started', 'pack_opened', 'profile_insight_viewed',
    'daily_objectives_viewed', 'daily_objective_claimed', 'weekly_summary_viewed'
  ));