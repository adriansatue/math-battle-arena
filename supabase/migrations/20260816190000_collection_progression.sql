alter table public.reward_catalog
  add column if not exists set_key text not null default 'arena_origins';

create table if not exists public.pack_opening_receipts (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_type text not null check (pack_type in ('basic', 'rare', 'legendary')),
  reward_ids uuid[] not null check (cardinality(reward_ids) = 3),
  grades integer[] not null check (cardinality(grades) = 3),
  gross_cost integer not null check (gross_cost >= 0),
  duplicate_count integer not null check (duplicate_count between 0 and 3),
  duplicate_reward_ids uuid[] not null default '{}'::uuid[],
  duplicate_refund integer not null check (duplicate_refund >= 0),
  net_cost integer not null check (net_cost >= 0),
  points_balance integer not null check (points_balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.collection_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_pack_type text not null default 'basic' check (selected_pack_type in ('basic', 'rare', 'legendary')),
  showcased_inventory_id uuid references public.user_inventory(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_set_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  set_key text not null,
  reward_coins integer not null check (reward_coins between 0 and 1000),
  claimed_at timestamptz not null default now(),
  primary key (user_id, set_key)
);

alter table public.pack_opening_receipts enable row level security;
alter table public.collection_preferences enable row level security;
alter table public.collection_set_claims enable row level security;
revoke all on table public.pack_opening_receipts from public, anon, authenticated;
revoke all on table public.collection_preferences from public, anon, authenticated;
revoke all on table public.collection_set_claims from public, anon, authenticated;

create or replace function public.settle_pack_opening(
  p_request_id uuid,
  p_user_id uuid,
  p_pack_type text,
  p_reward_ids uuid[],
  p_grades integer[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.pack_opening_receipts%rowtype;
  v_balance integer;
  v_cost integer;
  v_duplicate_count integer;
  v_duplicate_reward_ids uuid[];
  v_refund integer;
  v_net_cost integer;
begin
  if p_pack_type not in ('basic', 'rare', 'legendary')
    or cardinality(p_reward_ids) <> 3 or cardinality(p_grades) <> 3
    or exists (select 1 from unnest(p_grades) grade where grade not between 5 and 10) then
    raise exception 'invalid pack payload';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_receipt from public.pack_opening_receipts where request_id = p_request_id;
  if found then
    if v_receipt.user_id <> p_user_id or v_receipt.pack_type <> p_pack_type then
      raise exception 'request id already used';
    end if;
    return to_jsonb(v_receipt);
  end if;

  if (select count(*) from public.reward_catalog
      where id = any(p_reward_ids) and is_active) <> 3 then
    raise exception 'pack contains unavailable cards';
  end if;

  if p_pack_type = 'basic' and exists (
      select 1 from public.reward_catalog where id = any(p_reward_ids) and rarity not in ('common', 'uncommon'))
    or p_pack_type = 'rare' and (
      exists (select 1 from public.reward_catalog where id = any(p_reward_ids) and rarity not in ('uncommon', 'rare', 'legendary'))
      or not exists (select 1 from public.reward_catalog where id = any(p_reward_ids) and rarity in ('rare', 'legendary')))
    or p_pack_type = 'legendary' and exists (
      select 1 from public.reward_catalog where id = any(p_reward_ids) and rarity not in ('rare', 'legendary')) then
    raise exception 'cards do not match pack odds';
  end if;

  v_cost := case p_pack_type when 'basic' then 300 when 'rare' then 900 else 1800 end;
  select coalesce(points_balance, total_points, 0) into v_balance
  from public.profiles where id = p_user_id for update;
  if not found then raise exception 'profile not found'; end if;

  select count(*)::integer, coalesce(array_agg(reward_id), '{}'::uuid[]), coalesce(sum(case catalog.rarity
    when 'common' then 25 when 'uncommon' then 60 when 'rare' then 150 else 400 end), 0)::integer
  into v_duplicate_count, v_duplicate_reward_ids, v_refund
  from unnest(p_reward_ids) reward_id
  join public.reward_catalog catalog on catalog.id = reward_id
  where exists (
    select 1
    from public.user_inventory inventory
    join public.reward_catalog owned_catalog on owned_catalog.id = inventory.reward_id
    where inventory.user_id = p_user_id
      and lower(trim(owned_catalog.name)) = lower(trim(catalog.name))
  );

  v_net_cost := greatest(0, v_cost - v_refund);
  if v_balance < v_net_cost then raise exception 'insufficient coins'; end if;

  insert into public.user_inventory (user_id, reward_id, obtained_at, obtained_via, grade)
  select p_user_id, p_reward_ids[index], now(), 'pack_reward', p_grades[index]
  from generate_subscripts(p_reward_ids, 1) index;

  v_balance := v_balance - v_net_cost;
  update public.profiles set points_balance = v_balance where id = p_user_id;

  insert into public.pack_opening_receipts (
    request_id, user_id, pack_type, reward_ids, grades, gross_cost,
    duplicate_count, duplicate_reward_ids, duplicate_refund, net_cost, points_balance
  ) values (
    p_request_id, p_user_id, p_pack_type, p_reward_ids, p_grades, v_cost,
    v_duplicate_count, v_duplicate_reward_ids, v_refund, v_net_cost, v_balance
  ) returning * into v_receipt;

  return to_jsonb(v_receipt);
end;
$$;

create or replace function public.get_collection_progress(p_user_id uuid)
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
    'unique_cards', (select count(distinct lower(trim(catalog.name))) from public.user_inventory inventory
      join public.reward_catalog catalog on catalog.id = inventory.reward_id where inventory.user_id = p_user_id),
    'duplicates', greatest(0, (select count(*) - count(distinct lower(trim(catalog.name)))
      from public.user_inventory inventory join public.reward_catalog catalog on catalog.id = inventory.reward_id
      where inventory.user_id = p_user_id)),
    'sets', coalesce((select jsonb_agg(jsonb_build_object(
      'set_key', sets.set_key,
      'total', sets.total,
      'owned', sets.owned,
      'completed', sets.total > 0 and sets.owned = sets.total,
      'reward_coins', 500,
      'claimed', claims.claimed_at is not null
    ) order by sets.set_key)
    from (
      select cards.set_key, count(*)::integer as total,
        count(*) filter (where exists (
          select 1 from public.user_inventory inventory
          join public.reward_catalog owned_catalog on owned_catalog.id = inventory.reward_id
          where inventory.user_id = p_user_id and lower(trim(owned_catalog.name)) = cards.card_name
        ))::integer as owned
      from (select distinct set_key, lower(trim(name)) as card_name
        from public.reward_catalog where is_active) cards group by cards.set_key
    ) sets left join public.collection_set_claims claims
      on claims.user_id = p_user_id and claims.set_key = sets.set_key), '[]'::jsonb)
  ) into v_result
  from public.collection_preferences preferences
  join public.profiles profile on profile.id = preferences.user_id
  where preferences.user_id = p_user_id;
  return v_result;
end;
$$;

create or replace function public.set_collection_preference(
  p_user_id uuid,
  p_pack_type text default null,
  p_showcased_inventory_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pack_type is not null and p_pack_type not in ('basic', 'rare', 'legendary') then
    raise exception 'invalid pack type';
  end if;
  if p_showcased_inventory_id is not null and not exists (
    select 1 from public.user_inventory where id = p_showcased_inventory_id and user_id = p_user_id
  ) then raise exception 'card is not owned'; end if;

  insert into public.collection_preferences (user_id, selected_pack_type, showcased_inventory_id)
  values (p_user_id, coalesce(p_pack_type, 'basic'), p_showcased_inventory_id)
  on conflict (user_id) do update set
    selected_pack_type = coalesce(p_pack_type, collection_preferences.selected_pack_type),
    showcased_inventory_id = coalesce(p_showcased_inventory_id, collection_preferences.showcased_inventory_id),
    updated_at = now();
end;
$$;

create or replace function public.claim_collection_set_reward(p_user_id uuid, p_set_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_owned integer;
  v_balance integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_set_key, 0));
  if exists (select 1 from public.collection_set_claims where user_id = p_user_id and set_key = p_set_key) then
    raise exception 'set reward already claimed';
  end if;

  select count(*)::integer,
    count(*) filter (where exists (
      select 1 from public.user_inventory inventory
      join public.reward_catalog owned_catalog on owned_catalog.id = inventory.reward_id
      where inventory.user_id = p_user_id and lower(trim(owned_catalog.name)) = cards.card_name
    ))::integer
  into v_total, v_owned
  from (select distinct lower(trim(name)) as card_name
    from public.reward_catalog where is_active and set_key = p_set_key) cards;
  if v_total = 0 or v_owned <> v_total then raise exception 'set is incomplete'; end if;

  select coalesce(points_balance, total_points, 0) into v_balance
  from public.profiles where id = p_user_id for update;
  v_balance := v_balance + 500;
  update public.profiles set points_balance = v_balance where id = p_user_id;
  insert into public.collection_set_claims (user_id, set_key, reward_coins)
  values (p_user_id, p_set_key, 500);
  return jsonb_build_object('set_key', p_set_key, 'reward_coins', 500, 'points_balance', v_balance);
end;
$$;

revoke all on function public.settle_pack_opening(uuid, uuid, text, uuid[], integer[]) from public, anon, authenticated;
revoke all on function public.get_collection_progress(uuid) from public, anon, authenticated;
revoke all on function public.set_collection_preference(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.claim_collection_set_reward(uuid, text) from public, anon, authenticated;
grant execute on function public.settle_pack_opening(uuid, uuid, text, uuid[], integer[]) to service_role;
grant execute on function public.get_collection_progress(uuid) to service_role;
grant execute on function public.set_collection_preference(uuid, text, uuid) to service_role;
grant execute on function public.claim_collection_set_reward(uuid, text) to service_role;