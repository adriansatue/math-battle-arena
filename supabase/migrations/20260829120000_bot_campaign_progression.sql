-- Twenty-level PvE campaign progression and idempotent first-win rewards.

alter table public.battles
  add column if not exists bot_level smallint;

alter table public.battles
  drop constraint if exists battles_bot_level_valid;
alter table public.battles
  add constraint battles_bot_level_valid
  check (bot_level is null or bot_level between 1 and 20) not valid;

create table if not exists public.bot_campaign_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  highest_unlocked smallint not null default 1 check (highest_unlocked between 1 and 20),
  highest_defeated smallint not null default 0 check (highest_defeated between 0 and 20),
  total_wins integer not null default 0 check (total_wins >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_campaign_victories (
  user_id uuid not null references auth.users(id) on delete cascade,
  battle_id uuid not null references public.battles(id) on delete cascade,
  bot_level smallint not null check (bot_level between 1 and 20),
  first_level_clear boolean not null,
  bonus_coins integer not null check (bonus_coins >= 0),
  won_at timestamptz not null default now(),
  primary key (user_id, battle_id)
);

alter table public.bot_campaign_progress enable row level security;
alter table public.bot_campaign_victories enable row level security;
revoke all on table public.bot_campaign_progress from public, anon, authenticated;
revoke all on table public.bot_campaign_victories from public, anon, authenticated;

create or replace function public.get_bot_campaign_progress(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
select jsonb_build_object(
  'highest_unlocked', coalesce(progress.highest_unlocked, 1),
  'highest_defeated', coalesce(progress.highest_defeated, 0),
  'total_wins', coalesce(progress.total_wins, 0)
)
from (select 1) seed
left join public.bot_campaign_progress progress on progress.user_id = p_user_id;
$$;

create or replace function public.settle_bot_campaign_victory(
  p_user_id uuid,
  p_battle_id uuid,
  p_bonus_coins integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_battle public.battles%rowtype;
  v_progress public.bot_campaign_progress%rowtype;
  v_victory public.bot_campaign_victories%rowtype;
  v_first_clear boolean;
  v_awarded integer;
begin
  if p_bonus_coins < 0 or p_bonus_coins > 500 then raise exception 'invalid campaign reward'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_battle_id::text, 0));

  select * into v_victory from public.bot_campaign_victories
  where user_id = p_user_id and battle_id = p_battle_id;
  if found then
    select * into v_progress from public.bot_campaign_progress where user_id = p_user_id;
    return jsonb_build_object(
      'won', true, 'bot_level', v_victory.bot_level,
      'first_clear', v_victory.first_level_clear, 'bonus_coins', v_victory.bonus_coins,
      'highest_unlocked', v_progress.highest_unlocked, 'highest_defeated', v_progress.highest_defeated
    );
  end if;

  select * into strict v_battle from public.battles
  where id = p_battle_id and host_id = p_user_id and bot_id is not null and bot_level is not null
    and status = 'finished';

  if v_battle.winner_id is distinct from p_user_id then
    select * into v_progress from public.bot_campaign_progress where user_id = p_user_id;
    return jsonb_build_object(
      'won', false, 'bot_level', v_battle.bot_level,
      'first_clear', false, 'bonus_coins', 0,
      'highest_unlocked', coalesce(v_progress.highest_unlocked, 1),
      'highest_defeated', coalesce(v_progress.highest_defeated, 0)
    );
  end if;

  insert into public.bot_campaign_progress (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into strict v_progress from public.bot_campaign_progress
  where user_id = p_user_id for update;
  v_first_clear := v_battle.bot_level > v_progress.highest_defeated;
  v_awarded := case when v_first_clear then p_bonus_coins else 0 end;

  update public.bot_campaign_progress set
    highest_defeated = greatest(highest_defeated, v_battle.bot_level),
    highest_unlocked = greatest(highest_unlocked, least(20, v_battle.bot_level + 1)),
    total_wins = total_wins + 1,
    updated_at = now()
  where user_id = p_user_id
  returning * into v_progress;

  if v_awarded > 0 then
    update public.profiles
    set points_balance = coalesce(points_balance, 0) + v_awarded
    where id = p_user_id;
  end if;

  insert into public.bot_campaign_victories (
    user_id, battle_id, bot_level, first_level_clear, bonus_coins
  ) values (
    p_user_id, p_battle_id, v_battle.bot_level, v_first_clear, v_awarded
  ) returning * into v_victory;

  return jsonb_build_object(
    'won', true, 'bot_level', v_battle.bot_level,
    'first_clear', v_first_clear, 'bonus_coins', v_awarded,
    'highest_unlocked', v_progress.highest_unlocked, 'highest_defeated', v_progress.highest_defeated
  );
end;
$$;

create or replace function public.get_bot_campaign_battle_result(
  p_user_id uuid,
  p_battle_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
select jsonb_build_object(
  'won', victory.battle_id is not null,
  'bot_level', battle.bot_level,
  'first_clear', coalesce(victory.first_level_clear, false),
  'bonus_coins', coalesce(victory.bonus_coins, 0),
  'highest_unlocked', coalesce(progress.highest_unlocked, 1),
  'highest_defeated', coalesce(progress.highest_defeated, 0)
)
from public.battles battle
left join public.bot_campaign_victories victory
  on victory.battle_id = battle.id and victory.user_id = p_user_id
left join public.bot_campaign_progress progress on progress.user_id = p_user_id
where battle.id = p_battle_id and battle.host_id = p_user_id and battle.bot_level is not null;
$$;

revoke all on function public.get_bot_campaign_progress(uuid) from public, anon, authenticated;
revoke all on function public.settle_bot_campaign_victory(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.get_bot_campaign_battle_result(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_bot_campaign_progress(uuid) to service_role;
grant execute on function public.settle_bot_campaign_victory(uuid, uuid, integer) to service_role;
grant execute on function public.get_bot_campaign_battle_result(uuid, uuid) to service_role;