do $$
declare
  duplicate_profile record;
  candidate_username text;
  suffix_number integer;
begin
  for duplicate_profile in
    select id, username
    from (
      select
        id,
        username,
        row_number() over (
          partition by lower(username)
          order by created_at nulls last, id
        ) as duplicate_position
      from public.profiles
      where username is not null
    ) ranked_profiles
    where duplicate_position > 1
    order by lower(username), duplicate_position
  loop
    suffix_number := 2;

    loop
      candidate_username :=
        left(duplicate_profile.username, 20 - char_length('_' || suffix_number::text))
        || '_'
        || suffix_number::text;

      exit when not exists (
        select 1
        from public.profiles
        where lower(username) = lower(candidate_username)
      );

      suffix_number := suffix_number + 1;
    end loop;

    update public.profiles
    set
      username = candidate_username,
      username_customized = false
    where id = duplicate_profile.id;

    raise notice 'Renamed duplicate username % to % for profile %',
      duplicate_profile.username,
      candidate_username,
      duplicate_profile.id;
  end loop;
end;
$$;

create unique index if not exists profiles_username_case_insensitive_unique
  on public.profiles (lower(username))
  where username is not null;

comment on index public.profiles_username_case_insensitive_unique is
  'Prevents usernames that differ only by letter case.';