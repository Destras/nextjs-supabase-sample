-- activacionPorTelefono — solicitar_otp_activacion devuelve r_fichas.
--
-- La ProductSpec §6.3 pide loguear el caso "teléfono en más de una ficha" CON la
-- cantidad de fichas: es la señal que decide si el teléfono compartido existe de
-- verdad (P4 del grill). La función ya contaba las fichas y descartaba el número.
-- Cambia el tipo de retorno, así que hay drop + create.

drop function if exists public.solicitar_otp_activacion(text);

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
