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
revoke execute on function public.validar_otp(text, date) from public;
grant execute on function public.validar_otp(text, date) to service_role;
