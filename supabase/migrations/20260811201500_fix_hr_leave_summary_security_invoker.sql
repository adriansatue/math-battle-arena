-- Ensure this HR summary view uses the querying user's permissions/RLS.
-- The view is not defined in this repo, so keep this migration narrowly scoped.
alter view if exists public.hr_leave_summary
  set (security_invoker = true);
