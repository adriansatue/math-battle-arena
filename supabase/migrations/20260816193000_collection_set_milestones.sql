create table if not exists public.collection_set_definitions (
  set_key text primary key,
  display_name text not null,
  target_unique_cards integer not null check (target_unique_cards between 1 and 100),
  reward_coins integer not null check (reward_coins between 0 and 1000),
  is_active boolean not null default true
);

insert into public.collection_set_definitions (
  set_key, display_name, target_unique_cards, reward_coins
) values ('arena_origins', 'Arena Origins', 10, 500)
on conflict (set_key) do update set
  display_name = excluded.display_name,
  target_unique_cards = excluded.target_unique_cards,
  reward_coins = excluded.reward_coins;

alter table public.collection_set_definitions enable row level security;
revoke all on table public.collection_set_definitions from public, anon, authenticated;

create or replace function public.get_collection_progress_v2(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  insert into public.collection_preferences (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select jsonb_build_object(
    'selected_pack_type', preferences.selected_pack_type,
    'showcased_inventory_id', preferences.showcased_inventory_id,
    'points_balance', coalesce(profile.points_balance, profile.total_points, 0),
    'total_cards', (select count(distinct lower(trim(name))) from public.reward_catalog where is_active),
    'unique_cards', (select count(distinct lower(trim(catalog.name)))
      from public.user_inventory inventory join public.reward_catalog catalog on catalog.id = inventory.reward_id
      where inventory.user_id = p_user_id),
    'duplicates', greatest(0, (select count(*) - count(distinct lower(trim(catalog.name)))
      from public.user_inventory inventory join public.reward_catalog catalog on catalog.id = inventory.reward_id
      where inventory.user_id = p_user_id)),
    'sets', coalesce((select jsonb_agg(jsonb_build_object(
      'set_key', definitions.set_key,
      'display_name', definitions.display_name,
      'total', definitions.target_unique_cards,
      'owned', least(definitions.target_unique_cards, coalesce(owned.unique_cards, 0)),
      'completed', coalesce(owned.unique_cards, 0) >= definitions.target_unique_cards,
      'reward_coins', definitions.reward_coins,
      'claimed', claims.claimed_at is not null
    ) order by definitions.set_key)
    from public.collection_set_definitions definitions
    left join lateral (
      select count(distinct lower(trim(catalog.name)))::integer as unique_cards
      from public.user_inventory inventory
      join public.reward_catalog catalog on catalog.id = inventory.reward_id
      where inventory.user_id = p_user_id and catalog.set_key = definitions.set_key
    ) owned on true
    left join public.collection_set_claims claims
      on claims.user_id = p_user_id and claims.set_key = definitions.set_key
    where definitions.is_active), '[]'::jsonb)
  ) into v_result
  from public.collection_preferences preferences
  join public.profiles profile on profile.id = preferences.user_id
  where preferences.user_id = p_user_id;
  return v_result;
end;
$$;

create or replace function public.claim_collection_set_reward_v2(p_user_id uuid, p_set_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_definition public.collection_set_definitions%rowtype;
  v_owned integer;
  v_balance integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_set_key, 0));
  if exists (select 1 from public.collection_set_claims where user_id = p_user_id and set_key = p_set_key) then
    raise exception 'set reward already claimed';
  end if;

  select * into strict v_definition from public.collection_set_definitions
  where set_key = p_set_key and is_active;
  select count(distinct lower(trim(catalog.name)))::integer into v_owned
  from public.user_inventory inventory
  join public.reward_catalog catalog on catalog.id = inventory.reward_id
  where inventory.user_id = p_user_id and catalog.set_key = p_set_key;
  if v_owned < v_definition.target_unique_cards then raise exception 'set is incomplete'; end if;

  select coalesce(points_balance, total_points, 0) into v_balance
  from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile not found'; end if;
  v_balance := v_balance + v_definition.reward_coins;
  update public.profiles set points_balance = v_balance where id = p_user_id;
  insert into public.collection_set_claims (user_id, set_key, reward_coins)
  values (p_user_id, p_set_key, v_definition.reward_coins);
  return jsonb_build_object(
    'set_key', p_set_key,
    'reward_coins', v_definition.reward_coins,
    'points_balance', v_balance
  );
end;
$$;

revoke all on function public.get_collection_progress_v2(uuid) from public, anon, authenticated;
revoke all on function public.claim_collection_set_reward_v2(uuid, text) from public, anon, authenticated;
grant execute on function public.get_collection_progress_v2(uuid) to service_role;
grant execute on function public.claim_collection_set_reward_v2(uuid, text) to service_role;