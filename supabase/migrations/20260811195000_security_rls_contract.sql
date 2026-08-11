-- Security/RLS contract for Math Battle Arena.
-- This migration assumes the core tables already exist and makes the runtime
-- security model explicit and reproducible.

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_current_user_admin() to authenticated;

-- RLS decides which rows are visible/mutable; grants decide which operations
-- and columns the browser role can touch at all. Keep sensitive profile fields
-- server-only even when a row-level policy matches the current user.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

revoke insert, update, delete on public.battles from anon, authenticated;
grant select on public.battles to authenticated;

revoke all on public.battle_questions from anon, authenticated;
grant select (
  id,
  battle_id,
  sequence,
  question_text,
  category,
  difficulty,
  server_sent_at,
  claimed_by,
  claimed_at
) on public.battle_questions to authenticated;

revoke insert, update, delete on public.battle_answers from anon, authenticated;
grant select on public.battle_answers to authenticated;

revoke insert, update, delete on public.user_inventory from anon, authenticated;
grant select on public.user_inventory to authenticated;

revoke insert, update, delete on public.matchmaking_queue from anon, authenticated;

revoke insert, update, delete on public.reward_catalog from anon, authenticated;
grant select on public.reward_catalog to authenticated;

-- A safe projection for game clients. It intentionally omits correct_answer.
-- CREATE OR REPLACE VIEW cannot remove columns from an existing view, so drop
-- first to handle older local/prod versions that exposed extra columns.
drop view if exists public.battle_questions_safe;

create view public.battle_questions_safe
with (
  security_invoker = true,
  security_barrier = true
)
as
select
  q.id,
  q.battle_id,
  q.sequence,
  q.question_text,
  q.category,
  q.difficulty,
  q.server_sent_at,
  q.claimed_by,
  q.claimed_at
from public.battle_questions q
where public.is_current_user_admin()
   or exists (
    select 1
    from public.battles b
    where b.id = q.battle_id
      and (b.host_id = auth.uid() or b.guest_id = auth.uid())
  );

alter table public.profiles enable row level security;
alter table public.battles enable row level security;
alter table public.battle_questions enable row level security;
alter table public.battle_answers enable row level security;
alter table public.user_inventory enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.matchmaking_queue enable row level security;

-- Profiles: public leaderboard/profile reads, self username updates, admin access.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_authenticated') then
    create policy profiles_select_authenticated
      on public.profiles for select
      to authenticated
      using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own_or_admin') then
    create policy profiles_update_own_or_admin
      on public.profiles for update
      to authenticated
      using (id = auth.uid() or public.is_current_user_admin())
      with check (id = auth.uid() or public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_insert_own_or_admin') then
    create policy profiles_insert_own_or_admin
      on public.profiles for insert
      to authenticated
      with check (id = auth.uid() or public.is_current_user_admin());
  end if;
end $$;

-- Battles: users may see their own battles and finished battles for leaderboards.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'battles' and policyname = 'battles_select_participant_or_finished_or_admin') then
    create policy battles_select_participant_or_finished_or_admin
      on public.battles for select
      to authenticated
      using (
        public.is_current_user_admin()
        or host_id = auth.uid()
        or guest_id = auth.uid()
        or status = 'finished'
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'battles' and policyname = 'battles_insert_own_host') then
    create policy battles_insert_own_host
      on public.battles for insert
      to authenticated
      with check (host_id = auth.uid() or public.is_current_user_admin());
  end if;
end $$;

-- Correct answers and question mutations remain server/admin-only. Players only
-- receive column-limited reads for battles they participate in.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'battle_questions' and policyname = 'battle_questions_select_participants_or_admin') then
    create policy battle_questions_select_participants_or_admin
      on public.battle_questions for select
      to authenticated
      using (
        public.is_current_user_admin()
        or exists (
          select 1 from public.battles b
          where b.id = battle_questions.battle_id
            and (b.host_id = auth.uid() or b.guest_id = auth.uid())
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'battle_questions' and policyname = 'battle_questions_admin_all') then
    create policy battle_questions_admin_all
      on public.battle_questions for all
      to authenticated
      using (public.is_current_user_admin())
      with check (public.is_current_user_admin());
  end if;
end $$;

grant select on public.battle_questions_safe to authenticated;

-- Answers: players can read answers for battles they participate in; inserts are
-- permitted for their own row. Sensitive scoring writes are still validated server-side.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'battle_answers' and policyname = 'battle_answers_select_participants_or_admin') then
    create policy battle_answers_select_participants_or_admin
      on public.battle_answers for select
      to authenticated
      using (
        public.is_current_user_admin()
        or exists (
          select 1 from public.battles b
          where b.id = battle_answers.battle_id
            and (b.host_id = auth.uid() or b.guest_id = auth.uid())
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'battle_answers' and policyname = 'battle_answers_insert_own_participant') then
    create policy battle_answers_insert_own_participant
      on public.battle_answers for insert
      to authenticated
      with check (
        player_id = auth.uid()
        and exists (
          select 1 from public.battles b
          where b.id = battle_answers.battle_id
            and (b.host_id = auth.uid() or b.guest_id = auth.uid())
        )
      );
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'battle_answers' and policyname = 'battle_answers_admin_update') then
    create policy battle_answers_admin_update
      on public.battle_answers for update
      to authenticated
      using (public.is_current_user_admin())
      with check (public.is_current_user_admin());
  end if;
end $$;

-- Inventory and catalogue.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_inventory' and policyname = 'user_inventory_select_own_or_admin') then
    create policy user_inventory_select_own_or_admin
      on public.user_inventory for select
      to authenticated
      using (user_id = auth.uid() or public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'user_inventory' and policyname = 'user_inventory_admin_all') then
    create policy user_inventory_admin_all
      on public.user_inventory for all
      to authenticated
      using (public.is_current_user_admin())
      with check (public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reward_catalog' and policyname = 'reward_catalog_select_active_or_admin') then
    create policy reward_catalog_select_active_or_admin
      on public.reward_catalog for select
      to authenticated
      using (is_active = true or public.is_current_user_admin());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reward_catalog' and policyname = 'reward_catalog_admin_all') then
    create policy reward_catalog_admin_all
      on public.reward_catalog for all
      to authenticated
      using (public.is_current_user_admin())
      with check (public.is_current_user_admin());
  end if;
end $$;

-- Queue rows are only visible/mutable by their owner. Server routes use service role.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'matchmaking_queue' and policyname = 'matchmaking_queue_own_all') then
    create policy matchmaking_queue_own_all
      on public.matchmaking_queue for all
      to authenticated
      using (user_id = auth.uid() or public.is_current_user_admin())
      with check (user_id = auth.uid() or public.is_current_user_admin());
  end if;
end $$;

-- Constraints and indexes that back the application invariants.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_points_balance_nonnegative') then
    alter table public.profiles
      add constraint profiles_points_balance_nonnegative
      check (points_balance >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battles_host_guest_distinct') then
    alter table public.battles
      add constraint battles_host_guest_distinct
      check (guest_id is null or guest_id <> host_id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battles_status_valid') then
    alter table public.battles
      add constraint battles_status_valid
      check (status in ('waiting', 'active', 'finished')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battles_mode_valid') then
    alter table public.battles
      add constraint battles_mode_valid
      check (mode in ('realtime', 'turnbased')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battles_difficulty_valid') then
    alter table public.battles
      add constraint battles_difficulty_valid
      check (difficulty in ('easy', 'medium', 'hard')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battle_questions_sequence_positive') then
    alter table public.battle_questions
      add constraint battle_questions_sequence_positive
      check (sequence > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battle_questions_difficulty_valid') then
    alter table public.battle_questions
      add constraint battle_questions_difficulty_valid
      check (difficulty in ('easy', 'medium', 'hard')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battle_questions_category_valid') then
    alter table public.battle_questions
      add constraint battle_questions_category_valid
      check (category in ('addition', 'subtraction', 'multiplication', 'division', 'fractions', 'order_of_ops')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battle_answers_points_nonnegative') then
    alter table public.battle_answers
      add constraint battle_answers_points_nonnegative
      check (points_earned >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'battle_answers_time_nonnegative') then
    alter table public.battle_answers
      add constraint battle_answers_time_nonnegative
      check (time_taken_ms >= 0 and server_validated_ms >= 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'reward_catalog_rarity_valid') then
    alter table public.reward_catalog
      add constraint reward_catalog_rarity_valid
      check (rarity in ('common', 'uncommon', 'rare', 'legendary')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'user_inventory_grade_valid') then
    alter table public.user_inventory
      add constraint user_inventory_grade_valid
      check (grade is null or grade between 5 and 10) not valid;
  end if;
end $$;

create unique index if not exists battle_answers_one_per_player_question
  on public.battle_answers (question_id, player_id);

create unique index if not exists battle_questions_one_sequence_per_battle
  on public.battle_questions (battle_id, sequence);

create unique index if not exists matchmaking_queue_one_row_per_user
  on public.matchmaking_queue (user_id);

create index if not exists battles_participant_status_idx
  on public.battles (host_id, guest_id, status);

create index if not exists battle_answers_battle_player_idx
  on public.battle_answers (battle_id, player_id);

create index if not exists user_inventory_user_idx
  on public.user_inventory (user_id);
