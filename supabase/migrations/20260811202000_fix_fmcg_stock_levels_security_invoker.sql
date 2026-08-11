-- Ensure this FMCG stock view uses the querying user's permissions/RLS.
-- The view is not defined in this repo, so keep this migration narrowly scoped.
alter view if exists public.fmcg_stock_levels
  set (security_invoker = true);
