-- evaluar_otp: implementación omitida en la versión pública.
create or replace function public.evaluar_otp(
  p_otp              text,
  p_fecha_nacimiento date,
  out r_codigo        text,
  out r_paciente_id   uuid
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

-- Sin grant: privada. Solo la invocan funciones security definer del mismo módulo.
revoke execute on function public.evaluar_otp(text, date) from public;

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

-- Revocar acceso público (DEC-E0-3): solo la Edge Function via service_role.
revoke execute on function public.validar_otp(text, date) from public;
grant execute on function public.validar_otp(text, date) to service_role;

-- validar_otp_para_creacion: implementación omitida en la versión pública.
create or replace function public.validar_otp_para_creacion(
  p_otp              text,
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

-- Revocar acceso público (DEC-E0-3): solo la Edge Function via service_role.
revoke execute on function public.validar_otp_para_creacion(text, date) from public;
grant execute on function public.validar_otp_para_creacion(text, date) to service_role;

-- vincular_cuenta_paciente: implementación omitida en la versión pública.
create or replace function public.vincular_cuenta_paciente(p_otp text, p_user_id uuid)
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

-- Revocar acceso público (DEC-E0-3): solo la Edge Function via service_role.
revoke execute on function public.vincular_cuenta_paciente(text, uuid) from public;
grant execute on function public.vincular_cuenta_paciente(text, uuid) to service_role;
