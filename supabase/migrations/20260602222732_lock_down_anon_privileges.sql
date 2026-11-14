-- Lock the unauthenticated `anon` role out of the entire public schema.
--
-- Context: Supabase bootstraps `public` with default privileges that grant `anon`
-- full access to every table/function/sequence. The earlier
-- 20260503232546_fix_permissions migration revoked table grants from anon, but:
--   (a) function EXECUTE was still granted to anon by default (including the
--       SECURITY DEFINER RPCs), and
--   (b) the default privileges themselves were never changed, so every new object
--       kept re-granting anon and `supabase db diff` kept regenerating the grants.
--
-- This webconsole is admin/terapeuta only; `anon` must have zero access to app data.
-- Authenticated access remains governed by per-table RLS policies.

-- 1. Strip every existing privilege from anon on current objects.
revoke all on all tables    in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;

-- 2. Stop Postgres from auto-granting anon on objects created in the future.
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- 3. Remove anon's right to even access the schema. Auth (GoTrue) runs on the
--    `auth` schema, so the login/sign-up flows are unaffected; this only blocks
--    PostgREST requests made with the anon key against public.
revoke usage on schema public from anon;
