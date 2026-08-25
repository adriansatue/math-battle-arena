-- Registered-player rankings with profile emblems, available only to server routes.

create or replace function public.get_registered_leaderboard(
  p_order text default 'xp',
  p_limit integer default 50
)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id', ranked.id,
  'username', ranked.username,
  'total_points', ranked.total_points,
  'rating', ranked.rating,
  'level', ranked.level,
  'rank_title', ranked.rank_title,
  'wins', ranked.wins,
  'losses', ranked.losses,
  'best_streak', ranked.best_streak,
  'board_rank', ranked.position,
  'emblem', case when ranked.image_url is null then null else jsonb_build_object(
    'name', ranked.card_name,
    'rarity', ranked.rarity,
    'image_url', ranked.image_url,
    'grade', ranked.grade
  ) end
) order by ranked.position), '[]'::jsonb)
from (
  select
    p.id,
    coalesce(p.username, 'Jugador sin nombre') as username,
    coalesce(p.total_points, 0)::integer as total_points,
    coalesce(p.rating, 1000)::integer as rating,
    coalesce(p.level, 1)::integer as level,
    coalesce(p.rank_title, 'Starter') as rank_title,
    coalesce(p.wins, 0)::integer as wins,
    coalesce(p.losses, 0)::integer as losses,
    coalesce(p.best_streak, 0)::integer as best_streak,
    inventory.grade,
    catalog.name as card_name,
    catalog.rarity,
    catalog.image_url,
    row_number() over (order by
      case when p_order = 'rating' then coalesce(p.rating, 1000) end desc,
      case when p_order <> 'rating' then coalesce(p.total_points, 0) end desc,
      p.id
    ) as position
  from public.profiles p
  join auth.users users on users.id = p.id
    and coalesce(users.is_anonymous, false) = false
  left join public.collection_preferences preferences on preferences.user_id = p.id
  left join public.user_inventory inventory
    on inventory.id = preferences.showcased_inventory_id and inventory.user_id = p.id
  left join public.reward_catalog catalog on catalog.id = inventory.reward_id
  where coalesce(p.rank_title, '') <> 'AI Challenger'
    and coalesce(p.username, '') not ilike '%MathBot%'
  order by position
  limit least(greatest(p_limit, 1), 100)
) ranked;
$$;

revoke all on function public.get_registered_leaderboard(text, integer) from public, anon, authenticated;
grant execute on function public.get_registered_leaderboard(text, integer) to service_role;

create or replace function public.get_registered_player_emblems(p_user_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
select coalesce(jsonb_agg(jsonb_build_object(
  'id', users.id,
  'emblem', case when catalog.image_url is null then null else jsonb_build_object(
    'name', catalog.name,
    'rarity', catalog.rarity,
    'image_url', catalog.image_url,
    'grade', inventory.grade
  ) end
)), '[]'::jsonb)
from auth.users users
left join public.collection_preferences preferences on preferences.user_id = users.id
left join public.user_inventory inventory
  on inventory.id = preferences.showcased_inventory_id and inventory.user_id = users.id
left join public.reward_catalog catalog on catalog.id = inventory.reward_id
where users.id = any(coalesce(p_user_ids, '{}'::uuid[]))
  and coalesce(users.is_anonymous, false) = false;
$$;

revoke all on function public.get_registered_player_emblems(uuid[]) from public, anon, authenticated;
grant execute on function public.get_registered_player_emblems(uuid[]) to service_role;