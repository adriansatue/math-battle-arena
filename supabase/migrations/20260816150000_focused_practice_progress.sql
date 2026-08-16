create table if not exists public.student_weaknesses (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  accuracy_rate numeric not null default 0,
  total_attempts integer not null default 0,
  avg_speed_ms integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.student_weaknesses
  add column if not exists updated_at timestamptz not null default now();

delete from public.student_weaknesses first_row
using public.student_weaknesses duplicate_row
where first_row.user_id = duplicate_row.user_id
  and first_row.category = duplicate_row.category
  and first_row.ctid < duplicate_row.ctid;

create unique index if not exists student_weaknesses_user_category_idx
  on public.student_weaknesses (user_id, category);

alter table public.student_weaknesses enable row level security;
revoke all on table public.student_weaknesses from public, anon, authenticated;
grant select on table public.student_weaknesses to authenticated;

drop policy if exists "Players read own topic insights" on public.student_weaknesses;
create policy "Players read own topic insights"
  on public.student_weaknesses
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.practice_sessions (
  battle_id uuid primary key references public.battles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (topic in ('addition', 'subtraction', 'multiplication', 'division', 'fractions', 'order_of_ops')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  source text not null check (source in ('manual', 'results', 'profile')),
  baseline_attempts integer not null default 0 check (baseline_attempts between 0 and 20),
  baseline_correct integer not null default 0 check (baseline_correct between 0 and baseline_attempts),
  baseline_avg_ms integer check (baseline_avg_ms is null or baseline_avg_ms >= 0),
  previous_best_accuracy numeric check (previous_best_accuracy is null or previous_best_accuracy between 0 and 1),
  session_attempts integer check (session_attempts is null or session_attempts >= 0),
  session_correct integer check (session_correct is null or session_correct between 0 and session_attempts),
  session_avg_ms integer check (session_avg_ms is null or session_avg_ms >= 0),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists practice_sessions_user_topic_completed_idx
  on public.practice_sessions (user_id, topic, completed_at desc);

alter table public.practice_sessions enable row level security;
revoke all on table public.practice_sessions from public, anon, authenticated;

create or replace function public.start_focused_practice(
  p_battle_id uuid,
  p_user_id uuid,
  p_topic text,
  p_difficulty text,
  p_source text
)
returns setof public.practice_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.practice_sessions%rowtype;
begin
  if p_topic not in ('addition', 'subtraction', 'multiplication', 'division', 'fractions', 'order_of_ops') then
    raise exception 'unsupported practice topic';
  end if;

  if p_difficulty not in ('easy', 'medium', 'hard') then
    raise exception 'unsupported practice difficulty';
  end if;

  if p_source not in ('manual', 'results', 'profile') then
    raise exception 'unsupported practice source';
  end if;

  if not exists (
    select 1 from public.battles
    where id = p_battle_id and host_id = p_user_id and guest_id is null
  ) then
    raise exception 'practice battle does not belong to user';
  end if;

  insert into public.practice_sessions (
    battle_id,
    user_id,
    topic,
    difficulty,
    source,
    baseline_attempts,
    baseline_correct,
    baseline_avg_ms,
    previous_best_accuracy
  )
  select
    p_battle_id,
    p_user_id,
    p_topic,
    p_difficulty,
    p_source,
    count(recent.is_correct)::integer,
    count(*) filter (where recent.is_correct)::integer,
    round(avg(recent.response_ms))::integer,
    (
      select max(session_correct::numeric / nullif(session_attempts, 0))
      from public.practice_sessions
      where user_id = p_user_id
        and topic = p_topic
        and completed_at is not null
        and session_attempts >= 5
    )
  from (
    select
      ba.is_correct,
      coalesce(ba.server_validated_ms, ba.time_taken_ms) as response_ms
    from public.battle_answers ba
    join public.battle_questions bq on bq.id = ba.question_id
    where ba.player_id = p_user_id
      and bq.category = p_topic
      and ba.battle_id <> p_battle_id
      and coalesce(ba.flagged, false) = false
    order by ba.answered_at desc
    limit 20
  ) recent
  on conflict (battle_id) do nothing;

  select * into strict v_session
  from public.practice_sessions
  where battle_id = p_battle_id and user_id = p_user_id;

  return next v_session;
end;
$$;

create or replace function public.complete_focused_practice(
  p_battle_id uuid,
  p_user_id uuid
)
returns setof public.practice_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.practice_sessions%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('practice:' || p_battle_id::text, 0));

  select * into strict v_session
  from public.practice_sessions
  where battle_id = p_battle_id and user_id = p_user_id;

  if v_session.completed_at is null then
    update public.practice_sessions ps
    set
      session_attempts = aggregate.attempts,
      session_correct = aggregate.correct,
      session_avg_ms = aggregate.avg_ms,
      completed_at = now()
    from (
      select
        count(*)::integer as attempts,
        count(*) filter (where ba.is_correct)::integer as correct,
        round(avg(coalesce(ba.server_validated_ms, ba.time_taken_ms)))::integer as avg_ms
      from public.battle_answers ba
      join public.battle_questions bq on bq.id = ba.question_id
      where ba.battle_id = p_battle_id
        and ba.player_id = p_user_id
        and bq.category = v_session.topic
        and coalesce(ba.flagged, false) = false
    ) aggregate
    where ps.battle_id = p_battle_id;

    insert into public.student_weaknesses (
      user_id, category, accuracy_rate, total_attempts, avg_speed_ms, updated_at
    )
    select
      p_user_id,
      v_session.topic,
      count(*) filter (where history.is_correct)::numeric / nullif(count(*), 0),
      count(*)::integer,
      round(avg(history.response_ms))::integer,
      now()
    from (
      select
        ba.is_correct,
        coalesce(ba.server_validated_ms, ba.time_taken_ms) as response_ms
      from public.battle_answers ba
      join public.battle_questions bq on bq.id = ba.question_id
      where ba.player_id = p_user_id
        and bq.category = v_session.topic
        and coalesce(ba.flagged, false) = false
      order by ba.answered_at desc
      limit 100
    ) history
    having count(*) > 0
    on conflict (user_id, category) do update
    set
      accuracy_rate = excluded.accuracy_rate,
      total_attempts = excluded.total_attempts,
      avg_speed_ms = excluded.avg_speed_ms,
      updated_at = excluded.updated_at;
  end if;

  select * into strict v_session
  from public.practice_sessions
  where battle_id = p_battle_id and user_id = p_user_id;

  return next v_session;
end;
$$;

revoke all on function public.start_focused_practice(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.start_focused_practice(uuid, uuid, text, text, text)
  to service_role;

revoke all on function public.complete_focused_practice(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_focused_practice(uuid, uuid)
  to service_role;

comment on table public.practice_sessions is
  'Private focused-practice comparisons. Baseline is the latest 20 unflagged answers in the same topic before the session.';