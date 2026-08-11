-- Security contract checks for Math Battle Arena.
-- Run after applying migrations. The script raises an exception on the first
-- failed check and prints a success notice when the database matches the
-- expected browser-facing contract.

do $$
declare
  checked_view text;
  missing_safe_column text;
  unsafe_table text;
  unsafe_operation text;
  rls_table text;
  required_policy text;
  security_definer_view text;
begin
  -- No public view should run with the owner privileges. SECURITY INVOKER makes
  -- permissions and RLS evaluate as the querying role.
  select c.relname
    into security_definer_view
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'v'
    and not coalesce(c.reloptions @> array['security_invoker=true'], false)
  order by c.relname
  limit 1;

  if security_definer_view is not null then
    raise exception 'Public view % is not security_invoker.', security_definer_view;
  end if;

  foreach checked_view in array array[
    'battle_questions_safe',
    'ops_stock_by_warehouse',
    'fmcg_stock_levels',
    'hr_leave_summary'
  ]
  loop
    if to_regclass('public.' || checked_view) is not null
       and not coalesce(
        (
          select c.reloptions @> array['security_invoker=true']
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = checked_view
            and c.relkind = 'v'
        ),
        false
      )
    then
      raise exception 'View public.% exists but is not security_invoker.', checked_view;
    end if;
  end loop;

  -- Correct answers must never be directly selectable by browser roles.
  if to_regclass('public.battle_questions') is not null
     and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'battle_questions'
        and column_name = 'correct_answer'
    )
  then
    if has_column_privilege('authenticated', 'public.battle_questions', 'correct_answer', 'select') then
      raise exception 'authenticated can select battle_questions.correct_answer.';
    end if;

    if has_column_privilege('anon', 'public.battle_questions', 'correct_answer', 'select') then
      raise exception 'anon can select battle_questions.correct_answer.';
    end if;
  end if;

  -- The browser role should only receive safe battle question columns.
  foreach missing_safe_column in array array[
    'id',
    'battle_id',
    'sequence',
    'question_text',
    'category',
    'difficulty',
    'server_sent_at',
    'claimed_by',
    'claimed_at'
  ]
  loop
    if to_regclass('public.battle_questions') is not null
       and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'battle_questions'
          and column_name = missing_safe_column
       )
    then
      if not has_column_privilege('authenticated', 'public.battle_questions', missing_safe_column, 'select') then
        raise exception 'authenticated lacks select on safe battle_questions column %.', missing_safe_column;
      end if;
    end if;
  end loop;

  -- Sensitive writes must go through server-side API routes using the service role.
  foreach unsafe_table in array array[
    'battle_answers',
    'battles',
    'profiles',
    'reward_catalog',
    'user_inventory',
    'matchmaking_queue'
  ]
  loop
    foreach unsafe_operation in array array['insert', 'update', 'delete']
    loop
      if to_regclass('public.' || unsafe_table) is not null then
        if has_table_privilege('authenticated', 'public.' || unsafe_table, unsafe_operation) then
          raise exception 'authenticated unexpectedly has % on public.%.', unsafe_operation, unsafe_table;
        end if;

        if has_table_privilege('anon', 'public.' || unsafe_table, unsafe_operation) then
          raise exception 'anon unexpectedly has % on public.%.', unsafe_operation, unsafe_table;
        end if;
      end if;
    end loop;
  end loop;

  -- RLS should be enabled on all browser-reachable game tables.
  foreach rls_table in array array[
    'profiles',
    'battles',
    'battle_questions',
    'battle_answers',
    'user_inventory',
    'reward_catalog',
    'matchmaking_queue'
  ]
  loop
    if to_regclass('public.' || rls_table) is not null
       and not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = rls_table
          and c.relrowsecurity
       )
    then
      raise exception 'RLS is not enabled on public.%.', rls_table;
    end if;
  end loop;

  -- Key policies expected by the app contract.
  foreach required_policy in array array[
    'profiles_select_authenticated',
    'battles_select_participant_or_finished_or_admin',
    'battle_questions_select_participants_or_admin',
    'battle_answers_select_participants_or_admin',
    'user_inventory_select_own_or_admin',
    'reward_catalog_select_active_or_admin',
    'matchmaking_queue_own_all'
  ]
  loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and policyname = required_policy
    )
    then
      raise exception 'Missing expected RLS policy %.', required_policy;
    end if;
  end loop;

  raise notice 'Security contract checks passed.';
end $$;
