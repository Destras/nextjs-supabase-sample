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
