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

-- Privada: revocar execute de public (solo la invocan security definer del mismo módulo).
revoke execute on function public.generar_codigo_otp() from public;

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

-- Privada: revocar execute de public.
revoke execute on function public.hashear_otp(text) from public;

-- emitir_otp_activacion: implementación omitida en la versión pública.
create or replace function public.emitir_otp_activacion(p_paciente_id uuid)
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

comment on function public.emitir_otp_activacion(uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Privada: revocar execute de public.
revoke execute on function public.emitir_otp_activacion(uuid) from public;

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

-- Acceso: service_role únicamente (DEC-E0-5).
-- No a authenticated (el terapeuta entra vía set_entregas_plan, que ya es security definer).
-- No a anon (bloqueado globalmente por 00_anon_lockdown.sql).
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

-- Acceso: service_role únicamente (DEC-E0-5).
grant execute on function public.regenerar_otp_activacion(uuid) to service_role;
