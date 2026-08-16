with catalog_identity as (
  select
    id,
    first_value(id) over (
      partition by lower(trim(name))
      order by is_active desc, id::text
    ) as canonical_id
  from public.reward_catalog
), duplicates as (
  select id, canonical_id from catalog_identity where id <> canonical_id
)
update public.user_inventory inventory
set reward_id = duplicates.canonical_id
from duplicates
where inventory.reward_id = duplicates.id;

with catalog_identity as (
  select
    id,
    row_number() over (
      partition by lower(trim(name))
      order by is_active desc, id::text
    ) as identity_rank
  from public.reward_catalog
)
update public.reward_catalog catalog
set is_active = false
from catalog_identity identity
where catalog.id = identity.id and identity.identity_rank > 1;

create unique index if not exists reward_catalog_active_name_unique
  on public.reward_catalog (lower(trim(name)))
  where is_active;

alter table public.pack_opening_receipts
  add column if not exists duplicate_reward_ids uuid[] not null default '{}'::uuid[];

comment on index public.reward_catalog_active_name_unique is
  'One active catalogue row per collectible identity; repeated seed rows remain archived for referential history.';