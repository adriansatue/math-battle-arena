alter table public.profiles
  add column if not exists username_customized boolean not null default false;

comment on column public.profiles.username_customized is
  'True after a player has claimed or changed their generated username.';
