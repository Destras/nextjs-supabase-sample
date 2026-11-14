-- EXECUTE grants + search_path de resolver_documentos_legales_vigentes.
--
-- Migración hand-authored A PROPÓSITO, no por un bug de db diff: el skill
-- supabase-migration documenta que migra NO detecta ni los EXECUTE grants ni
-- el proconfig de una función. Sin esto, la función quedaría con el default
-- de Supabase — EXECUTE para authenticated y service_role (alter default
-- privileges ... grant execute on functions to authenticated, service_role) —
-- y cualquier paciente logueado podría resolver directamente qué documentos
-- son vigentes o forzar una condición de carrera contra createAccount.ts.
-- Mismo patrón que 20260831140100_baja_voluntaria_paciente_grants.sql.
--
-- Idempotente: alter/revoke/grant se pueden re-aplicar sin efecto.
--
-- Verificación (BLOCK 10 en supabase/tests/legal_documents.sql):
--   select proname, proconfig from pg_proc where proname = 'resolver_documentos_legales_vigentes';
--   select has_function_privilege('authenticated', 'public.resolver_documentos_legales_vigentes(jsonb)', 'execute');

alter function public.resolver_documentos_legales_vigentes(jsonb) set search_path = '';

revoke execute on function public.resolver_documentos_legales_vigentes(jsonb) from public;
revoke execute on function public.resolver_documentos_legales_vigentes(jsonb) from anon;
revoke execute on function public.resolver_documentos_legales_vigentes(jsonb) from authenticated;

grant execute on function public.resolver_documentos_legales_vigentes(jsonb) to service_role;
