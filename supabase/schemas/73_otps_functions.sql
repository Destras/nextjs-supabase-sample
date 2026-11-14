-- generar_codigo_otp: implementación omitida en la versión pública.
create or replace function public.generar_codigo_otp()
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

comment on function public.generar_codigo_otp() is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Sin grant: privada. Solo la invocan security definer que corren como owner postgres.
revoke execute on function public.generar_codigo_otp() from public, anon, authenticated;

-- hashear_otp: implementación omitida en la versión pública.
create or replace function public.hashear_otp(p_otp text)
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

comment on function public.hashear_otp(text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Sin grant: privada.
revoke execute on function public.hashear_otp(text) from public, anon, authenticated;

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

-- solicitar_otp_activacion: implementación omitida en la versión pública.
create or replace function public.solicitar_otp_activacion(p_telefono text)
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

comment on function public.solicitar_otp_activacion(text) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.solicitar_otp_activacion(text) from public, anon, authenticated;
grant execute on function public.solicitar_otp_activacion(text) to service_role;

-- marcar_otp_entregado: implementación omitida en la versión pública.
create or replace function public.marcar_otp_entregado(p_otp_id uuid)
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

comment on function public.marcar_otp_entregado(uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.marcar_otp_entregado(uuid) from public, anon, authenticated;
grant execute on function public.marcar_otp_entregado(uuid) to service_role;

-- generar_otp_activacion: implementación omitida en la versión pública.
create or replace function public.generar_otp_activacion(p_paciente_id uuid)
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

comment on function public.generar_otp_activacion(uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Devuelve el OTP en texto plano para un paciente arbitrario y no tiene ninguna
-- guarda de autorización, así que el revoke es lo único que la separa de anon.
-- Revocar solo de `public` NO alcanza en este proyecto: hay un grant por defecto
-- a `authenticated`, y `public` conserva USAGE sobre el schema, así que `anon`
-- llega igual por PUBLIC (ver el revoke de vincular_cuenta_paciente más abajo).
revoke execute on function public.generar_otp_activacion(uuid) from public, anon, authenticated;
grant execute on function public.generar_otp_activacion(uuid) to service_role;

-- regenerar_otp_activacion: implementación omitida en la versión pública.
create or replace function public.regenerar_otp_activacion(p_paciente_id uuid)
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

comment on function public.regenerar_otp_activacion(uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Mismo caso que generar_otp_activacion: sin guarda de autorización y devuelve
-- el plaintext. Revocar de los tres, no solo de `public`.
revoke execute on function public.regenerar_otp_activacion(uuid) from public, anon, authenticated;
grant execute on function public.regenerar_otp_activacion(uuid) to service_role;

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

-- validar_otp: implementación omitida en la versión pública.
create or replace function public.validar_otp(p_otp text, p_fecha_nacimiento date)
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

comment on function public.validar_otp(text, date) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Revocar acceso público (DEC-E0-3): solo la Edge Function via service_role.
revoke execute on function public.validar_otp(text, date) from public, anon, authenticated;
grant execute on function public.validar_otp(text, date) to service_role;

-- validar_otp_para_creacion: implementación omitida en la versión pública.
create or replace function public.validar_otp_para_creacion(
  p_otp            text,
  p_fecha_nacimiento date
)
returns table (paciente_id uuid, email text, codigo text)
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

comment on function public.validar_otp_para_creacion(text, date) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Revocar acceso público (DEC-E0-3): solo la Edge Function via service_role.
revoke execute on function public.validar_otp_para_creacion(text, date) from public, anon, authenticated;
grant execute on function public.validar_otp_para_creacion(text, date) to service_role;

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
