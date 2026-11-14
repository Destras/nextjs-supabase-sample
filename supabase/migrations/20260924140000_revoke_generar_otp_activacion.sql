-- Cierra generar_otp_activacion / regenerar_otp_activacion a service_role.
--
-- HALLAZGO (security review de activacionPorTelefono, severidad alta, verificado
-- en vivo contra el stack local): las dos funciones son `security definer`,
-- devuelven el OTP de activación EN TEXTO PLANO para un p_paciente_id
-- arbitrario, y no tienen ninguna guarda de autorización — solo guardas de
-- estado del paciente (tiene cuenta, baja voluntaria, cooldown de 60s). Nunca se
-- les revocó el EXECUTE, así que el grant implícito `EXECUTE TO PUBLIC` de
-- PostgreSQL sobrevivía:
--
--   generar_otp_activacion(uuid)   | {=X/postgres,postgres=X,authenticated=X,service_role=X}
--   regenerar_otp_activacion(uuid) | {=X/postgres,postgres=X,authenticated=X,service_role=X}
--
-- El `=X` es PUBLIC. Y `anon` llega por ahí porque el schema public conserva
-- `=U/pg_database_owner` (USAGE a PUBLIC): el `revoke usage on schema public
-- from anon` de 00_anon_lockdown.sql saca un grant que anon nunca tuvo
-- individualmente, así que no protege nada. Con PostgREST exponiendo `public`
-- (config.toml), la función se alcanzaba por HTTP con la sola publishable key:
--
--   POST /rest/v1/rpc/regenerar_otp_activacion  {"p_paciente_id": "<uuid>"}
--   → el código de 6 dígitos del paciente, en el body de la respuesta.
--
-- Con ese código y la fecha de nacimiento, create-account (verify_jwt = false)
-- crea la cuenta con el email real del paciente y la contraseña que elija quien
-- llame. Y como los pacientes se autentican contra el mismo proyecto, el grant a
-- `authenticated` significaba además que cualquier paciente activado podía
-- emitir el OTP de cualquier otro.
--
-- El problema es preexistente (viene de 20260622200000_otps_generacion.sql;
-- `create or replace` preserva las ACLs, así que ninguna migración posterior lo
-- introdujo ni lo agravó). Se arregla acá porque activacionPorTelefono dejó a
-- las dos funciones sin callers en las Edge Functions —solo las usan
-- .scripts/get-otp.sh, .scripts/setup-otp-local.sh y e2e/utils/patient.ts—, así
-- que el grant sobrante es superficie de ataque que ya no le sirve a nadie.
--
-- El encabezado de generar_otp_activacion en 73_otps_functions.sql ya declaraba
-- "No a authenticated. No a anon." desde el día uno: esto lo implementa.
--
-- Escrita a mano: `db diff` no detecta cambios de EXECUTE grants (y en este repo
-- tampoco corre — shadow db rota). Espeja
-- supabase/schemas/73_otps_functions.sql.
--
-- Revocar solo de `public` no alcanza en este proyecto: hay un grant por defecto
-- a `authenticated` (ver 65_alertas.sql). Se revoca de los tres, como en
-- solicitar_otp_activacion, marcar_otp_entregado y vincular_cuenta_paciente.

revoke execute on function public.generar_otp_activacion(uuid) from public, anon, authenticated;
grant execute on function public.generar_otp_activacion(uuid) to service_role;

revoke execute on function public.regenerar_otp_activacion(uuid) from public, anon, authenticated;
grant execute on function public.regenerar_otp_activacion(uuid) to service_role;

comment on function public.regenerar_otp_activacion(uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Guard: si alguna de las dos quedara accesible, abortar la migración.
do $$
begin
  if has_function_privilege('anon', 'public.generar_otp_activacion(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.generar_otp_activacion(uuid)', 'execute')
     or has_function_privilege('anon', 'public.regenerar_otp_activacion(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.regenerar_otp_activacion(uuid)', 'execute')
  then
    raise exception 'revoke_generar_otp_activacion: anon o authenticated conservan EXECUTE';
  end if;
end $$;
