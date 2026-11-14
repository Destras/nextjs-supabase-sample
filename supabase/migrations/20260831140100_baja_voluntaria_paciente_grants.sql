-- baja-voluntaria-cuenta-paciente, Fase 2: grants y search_path de
-- baja_voluntaria_paciente.
--
-- Migración hand-authored A PROPÓSITO, no por el bug de db diff: el skill
-- supabase-migration documenta que migra NO detecta ni los EXECUTE grants ni el
-- proconfig de una función. Si esto no estuviera acá, la función quedaría con el
-- default de Postgres — EXECUTE para PUBLIC — y cualquier paciente logueado
-- podría llamarla con el p_user_id de otro y cerrarle la cuenta. Eso es el
-- agujero de IDOR completo, así que no puede depender de que un generador lo
-- infiera.
--
-- Idempotente: alter/revoke/grant se pueden re-aplicar sin efecto.
--
-- Verificación (asserts A11/A12 en supabase/tests/baja_voluntaria.sql):
--   select proname, proconfig from pg_proc where proname = 'baja_voluntaria_paciente';
--   select has_function_privilege('authenticated', 'public.baja_voluntaria_paciente(uuid)', 'execute');

alter function public.baja_voluntaria_paciente(uuid) set search_path = '';

-- Sin search_path fijo, una función security definer es un vector de escalación
-- de privilegios: el llamador puede anteponer un schema propio y secuestrar la
-- resolución de nombres.

-- Revocar a PUBLIC no alcanza, y este es el punto no obvio: Supabase corre
--   alter default privileges for role postgres in schema public
--     grant execute on functions to authenticated, service_role;
-- (visible en pg_default_acl), así que toda función nueva creada por postgres en
-- public nace con un grant DIRECTO a authenticated. Un revoke a PUBLIC no lo
-- toca. Sin las tres líneas de abajo, cualquier paciente logueado podría llamar
-- la RPC con el p_user_id de otro y cerrarle la cuenta.
--
-- Verificado en local: con solo el revoke a public,
--   has_function_privilege('authenticated', 'public.baja_voluntaria_paciente(uuid)', 'execute')
-- devuelve TRUE. El assert A11 de supabase/tests/baja_voluntaria.sql es lo que
-- lo detectó.

revoke execute on function public.baja_voluntaria_paciente(uuid) from public;
revoke execute on function public.baja_voluntaria_paciente(uuid) from anon;
revoke execute on function public.baja_voluntaria_paciente(uuid) from authenticated;

-- Solo la Edge Function paciente-cuenta, que corre con service_role y ya probó
-- que p_user_id es el sub del JWT del llamador.

grant execute on function public.baja_voluntaria_paciente(uuid) to service_role;
