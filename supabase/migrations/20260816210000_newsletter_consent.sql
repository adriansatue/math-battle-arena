alter table public.user_email_preferences
  add column if not exists newsletter_opt_in boolean not null default false,
  add column if not exists newsletter_opted_in_at timestamptz,
  add column if not exists newsletter_unsubscribed_at timestamptz;

alter table public.user_email_preferences
  add constraint newsletter_opt_in_timestamp_check
  check (not newsletter_opt_in or newsletter_opted_in_at is not null);

create or replace function public.unsubscribe_newsletter_by_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_updated integer;
begin
  update public.user_email_preferences preferences
  set newsletter_opt_in = false,
      newsletter_unsubscribed_at = now(),
      updated_at = now()
  from auth.users users
  where users.id = preferences.user_id
    and lower(users.email) = lower(p_email);
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.unsubscribe_newsletter_by_email(text) from public, anon, authenticated;
grant execute on function public.unsubscribe_newsletter_by_email(text) to service_role;

comment on column public.user_email_preferences.newsletter_opt_in is
  'Separate explicit consent for editorial game updates sent through Resend Broadcasts.';
