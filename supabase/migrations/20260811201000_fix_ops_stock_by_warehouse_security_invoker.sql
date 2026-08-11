-- Ensure this operational view uses the querying user's permissions/RLS.
-- The view is not defined in this repo, so keep this migration narrowly scoped.
alter view if exists public.ops_stock_by_warehouse
  set (security_invoker = true);
