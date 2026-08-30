-- Remove the original 20-level ceiling so new catalog levels can be appended safely.

alter table public.battles
  drop constraint if exists battles_bot_level_valid;
alter table public.battles
  add constraint battles_bot_level_valid
  check (bot_level is null or bot_level >= 1) not valid;

alter table public.bot_campaign_progress
  drop constraint if exists bot_campaign_progress_highest_unlocked_check;
alter table public.bot_campaign_progress
  drop constraint if exists bot_campaign_progress_highest_defeated_check;
alter table public.bot_campaign_progress
  add constraint bot_campaign_progress_highest_unlocked_check check (highest_unlocked >= 1);
alter table public.bot_campaign_progress
  add constraint bot_campaign_progress_highest_defeated_check check (highest_defeated >= 0);

alter table public.bot_campaign_victories
  drop constraint if exists bot_campaign_victories_bot_level_check;
alter table public.bot_campaign_victories
  add constraint bot_campaign_victories_bot_level_check check (bot_level >= 1);

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
    highest_unlocked = greatest(highest_unlocked, v_battle.bot_level + 1),
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

revoke all on function public.settle_bot_campaign_victory(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.settle_bot_campaign_victory(uuid, uuid, integer) to service_role;