-- Manual migration: harden security-sensitive functions.
--
-- Why manual: `supabase db diff` (migra) does not detect changes to a
-- function's `proconfig` (the `set search_path = ''` clause) nor to its
-- EXECUTE grants. The schema files in `supabase/schemas/` carry the new
-- desired state; this migration applies the parts migra cannot diff.
--
-- Supabase advisor findings addressed:
--   1. function_search_path_mutable on public.handle_new_user (WARN)
--   2. function_search_path_mutable on public.set_updated_at  (WARN)
--   3. anon_security_definer_function_executable on public.handle_new_user (WARN)
--   4. authenticated_security_definer_function_executable on public.handle_new_user (WARN)
--
-- Fixes:
--   * pin search_path to empty for both functions
--   * revoke execute on handle_new_user from API roles so it only runs as a
--     trigger (not via /rest/v1/rpc/handle_new_user)

-- public.set_updated_at: utility trigger function used by every set_<table>_updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is 'Trigger helper: setea updated_at = now() en cada UPDATE. Usado por todos los set_<table>_updated_at triggers.';

-- public.handle_new_user: auth trigger that bootstraps public.profiles on new auth.users rows
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

comment on function public.handle_new_user is 'Auth trigger: crea fila en public.profiles cuando se da de alta un usuario en auth.users.';

revoke execute on function public.handle_new_user() from anon, authenticated, public;
