-- ============================================================
-- Fixes "permission denied for table X" from supabase-js /
-- PostgREST after creating tables via the SQL Editor (or any
-- raw psql connection) instead of Supabase's own tooling.
--
-- Why this happens: Supabase's dashboard/migration flow quietly
-- grants privileges on new tables to anon/authenticated/service_role
-- as part of its own setup. A plain CREATE TABLE run by hand does
-- not — so PostgREST authenticates as one of those Postgres roles,
-- finds the table (schema cache is fine), but Postgres itself
-- refuses the query. This is a plain GRANT issue, not Row Level
-- Security — service_role bypasses RLS by design regardless.
--
-- Safe to re-run any time; does not touch data.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- So any table created later (e.g. BANK_ACCOUNT today, or a future
-- migration) gets the same grants automatically, no matter which
-- role runs the CREATE TABLE.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- Force PostgREST to pick up the change immediately instead of
-- waiting for its next periodic schema-cache refresh.
NOTIFY pgrst, 'reload schema';
