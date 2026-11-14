-- =============================================================================
-- paciente-auth — OTP de cambio de contraseña (ADR-0013)
-- =============================================================================
-- Migración escrita a mano (db diff no anda en este repo). Espejo de
-- supabase/schemas/22_otps_activacion.sql y 73_otps_functions.sql.
--
--   1. otps_activacion.purpose: 'recovery' (sin uso, ninguna fila) pasa a
--      'cambio_password'.
--   2. emitir_otp_activacion suma p_purpose (default 'activation'). Cambia la
--      firma, así que se dropea la de 2 argumentos.
--   3. evaluar_otp y vincular_cuenta_paciente filtran purpose = 'activation':
--      un código de contraseña no sirve para activar.
--   4. RPCs nuevas del cambio de contraseña (solo service_role):
--      solicitar_, verificar_ y canjear_otp_cambio_password, y las privadas
--      resolver_paciente_cambio_password y evaluar_otp_cambio_password, y la
--      red de seguridad cerrar_sesiones_cambio_password.
-- =============================================================================

-- 1. purpose
alter table public.otps_activacion drop constraint otps_activacion_purpose_check;
alter table public.otps_activacion
  add constraint otps_activacion_purpose_check check (purpose in ('activation', 'cambio_password'));

comment on table public.otps_activacion is 'Códigos de activación OTP hasheados (HMAC-SHA256 + pepper en Vault). RLS lockdown total: solo security definer y service-role pueden acceder. Un único OTP active por paciente y hash único global entre activos. delivered_at (null = nunca entregado) marca cuándo se entregó el código al paciente por WhatsApp; lo setea marcar_otp_entregado y lo usa solicitar_otp_activacion para el tope diario (activacionPorTelefono, Epic 1). Pese al nombre guarda TODOS los OTP del paciente: purpose distingue activation de cambio_password (ADR-0013); toda lectura filtra por purpose y los límites (cooldown, bloqueo, tope diario) cuentan por paciente sin mirarlo.';

-- 2. emitir_otp_activacion(uuid, interval, text)
drop function public.emitir_otp_activacion(uuid, interval);

-- emitir_otp_activacion: implementación omitida en la versión pública.
create or replace function public.emitir_otp_activacion(
  p_paciente_id uuid,
  p_vigencia    interval,
  p_purpose     text default 'activation'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.emitir_otp_activacion(uuid, interval, text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Sin grant: privada.
revoke execute on function public.emitir_otp_activacion(uuid, interval, text) from public, anon, authenticated;

-- evaluar_otp: implementación omitida en la versión pública.
create or replace function public.evaluar_otp(
  p_otp            text,
  p_fecha_nacimiento date,
  out r_codigo      text,
  out r_paciente_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.evaluar_otp(text, date) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Sin grant: privada. Solo la invocan funciones security definer del mismo módulo.
revoke execute on function public.evaluar_otp(text, date) from public, anon, authenticated;

-- vincular_cuenta_paciente: implementación omitida en la versión pública.
create or replace function public.vincular_cuenta_paciente(
  p_otp text,
  p_user_id uuid,
  p_documentos jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.vincular_cuenta_paciente(text, uuid, jsonb) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Revocar acceso público (DEC-E0-3): solo la Edge Function via service_role.
-- Los tres revokes explícitos (public, anon, authenticated) matchean la
-- migración manual (20260913190849_vincular_cuenta_paciente_v2.sql) — revocar
-- solo de public no alcanza en este proyecto (mismo patrón que
-- resolver_documentos_legales_vigentes en 77_rpcs_documentos_legales.sql).
-- `db diff`/migra no detecta EXECUTE grants (limitación conocida, ver
-- .claude/skills/supabase-migration/SKILL.md), así que este archivo y la
-- migración deben mantenerse en sync a mano.
revoke execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) from public;
revoke execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) from anon;
revoke execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) from authenticated;
grant execute on function public.vincular_cuenta_paciente(text, uuid, jsonb) to service_role;

-- resolver_paciente_cambio_password: implementación omitida en la versión pública.
create or replace function public.resolver_paciente_cambio_password(
  p_user_id  uuid,
  p_telefono text
)
returns table (
  r_resultado   text,
  r_paciente_id uuid,
  r_fichas      int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.resolver_paciente_cambio_password(uuid, text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.resolver_paciente_cambio_password(uuid, text) from public, anon, authenticated;

-- solicitar_otp_cambio_password: implementación omitida en la versión pública.
create or replace function public.solicitar_otp_cambio_password(
  p_user_id  uuid,
  p_telefono text
)
returns table (
  r_resultado   text,
  r_paciente_id uuid,
  r_otp_id      uuid,
  r_codigo      text,
  r_fichas      int
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.solicitar_otp_cambio_password(uuid, text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.solicitar_otp_cambio_password(uuid, text) from public, anon, authenticated;
grant execute on function public.solicitar_otp_cambio_password(uuid, text) to service_role;

-- evaluar_otp_cambio_password: implementación omitida en la versión pública.
create or replace function public.evaluar_otp_cambio_password(
  p_user_id  uuid,
  p_telefono text,
  p_otp      text,
  out r_resultado   text,
  out r_paciente_id uuid,
  out r_otp_id      uuid,
  out r_user_id     uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.evaluar_otp_cambio_password(uuid, text, text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.evaluar_otp_cambio_password(uuid, text, text) from public, anon, authenticated;

-- verificar_otp_cambio_password: implementación omitida en la versión pública.
create or replace function public.verificar_otp_cambio_password(
  p_user_id  uuid,
  p_telefono text,
  p_otp      text
)
returns table (
  r_resultado text,
  r_user_id   uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.verificar_otp_cambio_password(uuid, text, text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.verificar_otp_cambio_password(uuid, text, text) from public, anon, authenticated;
grant execute on function public.verificar_otp_cambio_password(uuid, text, text) to service_role;

-- canjear_otp_cambio_password: implementación omitida en la versión pública.
create or replace function public.canjear_otp_cambio_password(
  p_user_id  uuid,
  p_telefono text,
  p_otp      text
)
returns table (
  r_resultado text,
  r_email     text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.canjear_otp_cambio_password(uuid, text, text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.canjear_otp_cambio_password(uuid, text, text) from public, anon, authenticated;
grant execute on function public.canjear_otp_cambio_password(uuid, text, text) to service_role;

-- cerrar_sesiones_cambio_password: implementación omitida en la versión pública.
create or replace function public.cerrar_sesiones_cambio_password(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$$;

comment on function public.cerrar_sesiones_cambio_password(uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.cerrar_sesiones_cambio_password(uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_cambio_password(uuid) to service_role;
