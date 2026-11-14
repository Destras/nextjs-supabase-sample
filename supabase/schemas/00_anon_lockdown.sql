-- Anon lockdown (defense in depth) — must run BEFORE any table/function is created.
--
-- Supabase's project bootstrap runs the equivalent of:
--   alter default privileges in schema public grant all on tables/functions/sequences to anon;
-- which auto-grants the unauthenticated `anon` role full access to every object
-- created in `public`. This webconsole is admin/terapeuta only: `anon` must never
-- touch application data.
--
-- We strip those default grants here, at the very top of the declarative schema, so:
--   1. the shadow DB used by `supabase db diff` never re-introduces anon grants
--      (this is what produced the spurious `grant ... to "anon"` migration churn), and
--   2. any object added later inherits zero anon privileges automatically.
--
-- Authenticated access stays governed by the per-table RLS policies.
alter default privileges for role postgres in schema public revoke all on tables    from anon;
alter default privileges for role postgres in schema public revoke all on functions  from anon;
alter default privileges for role postgres in schema public revoke all on sequences  from anon;

-- Funciones (seguridadPanel / SEG-005). El revoke de arriba sobre funciones NO
-- alcanza por sí solo, por dos motivos que se midieron en local:
--
--   1. Postgres le da EXECUTE a PUBLIC en toda función nueva. Ese default es
--      global: un `alter default privileges ... in schema public` no lo puede
--      sacar (los defaults por schema solo SUMAN a los globales). Por eso el
--      revoke de PUBLIC va SIN `in schema`. `anon` es miembro de PUBLIC: con
--      ese default, 41 funciones de public eran ejecutables sin login por
--      PostgREST aunque `anon` no tuviera ningún grant propio.
--   2. El bootstrap de Supabase deja además un default que le da EXECUTE a
--      `authenticated` en toda función de public: funciones escritas como
--      "privadas" (`revoke ... from public`) las podía llamar cualquier usuario
--      logueado, pacientes incluidos.
--
-- Con estas dos líneas, toda función que cree `postgres` nace ejecutable solo
-- por su dueño y por service_role. Quien deba ejecutarla lo dice con un
-- `grant execute ... to authenticated` explícito junto a la función. Si falta,
-- la llamada falla con "permission denied for function": se nota enseguida.
-- La lista de lo que `authenticated` puede ejecutar la fija el test
-- los tests de seguridad (no incluidos en este repo).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from authenticated;

-- `anon` no tiene USAGE propio sobre el schema public. OJO: esto solo NO cierra
-- nada, porque PUBLIC conserva su USAGE sobre el schema y `anon` lo hereda. Lo
-- que de verdad deja a `anon` sin nada es que no tiene privilegios sobre
-- ninguna tabla, función ni secuencia (los defaults de arriba). Auth (GoTrue)
-- vive en el schema `auth`: el login no se ve afectado.
-- No se le saca el USAGE a PUBLIC: lo usan roles de la plataforma que no se
-- pueden probar en local, y no agrega nada a lo anterior.
revoke usage on schema public from anon;
