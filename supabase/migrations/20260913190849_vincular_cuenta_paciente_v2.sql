-- ---------------------------------------------------------------------------
-- vincular_cuenta_paciente v2
-- ---------------------------------------------------------------------------
-- `supabase db diff` also emitted ~200 lines of pre-existing, unrelated
-- grant-duplication noise for other tables (documented gap, see the
-- precedent in 20260831120000_schema_comment_drift_and_authenticated_lockdown.sql
-- and 20260913183051_consentimiento_documentos_legales_schema.sql). Hand-pruned
-- here to keep only the statements this PR actually changes.
--
-- `db diff` DID correctly detect and emit the `drop function` for the old
-- 2-arg overload below (declarative schema no longer declares it) and the
-- `create or replace function` for the new 3-arg overload. It did NOT
-- capture EXECUTE grants (known migra limitation, see .claude/supabase-
-- declarative-database-schema.md and the supabase-migration skill) — those
-- are hand-added below, alongside the function comment (also not captured).
-- ---------------------------------------------------------------------------

-- Elimina explícitamente el overload viejo (text, uuid): un consent bypass si
-- quedara vivo junto al nuevo (text, uuid, jsonb).
drop function if exists "public"."vincular_cuenta_paciente"(p_otp text, p_user_id uuid);

set check_function_bodies = off;

-- vincular_cuenta_paciente: implementación omitida en la versión pública.
CREATE OR REPLACE FUNCTION public.vincular_cuenta_paciente(p_otp text, p_user_id uuid, p_documentos jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$function$
;

comment on function public.vincular_cuenta_paciente(text, uuid, jsonb) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- EXECUTE grants: no capturados por `db diff` (mismo gotcha que
-- resolver_documentos_legales_vigentes en 20260913183100_documentos_legales_resolver_grants.sql).
-- El overload viejo ya no existe (drop de arriba), así que solo hace falta
-- fijar los grants del nuevo.
revoke execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) from public;
revoke execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) from anon;
revoke execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) from authenticated;

grant execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) to service_role;
