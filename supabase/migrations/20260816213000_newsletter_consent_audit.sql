alter table public.user_email_preferences
  add column if not exists newsletter_prompted_at timestamptz,
  add column if not exists newsletter_decided_at timestamptz,
  add column if not exists newsletter_consent_source text,
  add column if not exists newsletter_consent_version text;

alter table public.user_email_preferences
  add constraint newsletter_consent_source_check
  check (newsletter_consent_source is null or newsletter_consent_source in ('lobby_prompt', 'profile', 'resend'));

update public.user_email_preferences
set newsletter_decided_at = coalesce(newsletter_opted_in_at, newsletter_unsubscribed_at),
    newsletter_consent_source = 'profile',
    newsletter_consent_version = '2026-08-16'
where newsletter_decided_at is null
  and (newsletter_opted_in_at is not null or newsletter_unsubscribed_at is not null);

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
      newsletter_decided_at = now(),
      newsletter_consent_source = 'resend',
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

comment on column public.user_email_preferences.newsletter_decided_at is
  'Time of the latest explicit newsletter accept or decline decision.';
comment on column public.user_email_preferences.newsletter_consent_source is
  'Surface where the latest newsletter decision was made.';
