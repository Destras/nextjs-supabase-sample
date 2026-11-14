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

comment on function public.vincular_cuenta_paciente(text, uuid) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

-- Revocar acceso público (DEC-E0-3): solo la Edge Function via service_role.
-- Tres revokes explícitos (public, anon, authenticated) — mismo estándar de
-- higiene que la versión 3-arg (73_otps_functions.sql), no el
-- revoke-from-public-only que tenía el original en main (ver
-- 20260622240000_crear_cuenta_paciente_fns.sql).
revoke execute on function public.vincular_cuenta_paciente(text, uuid) from public;
revoke execute on function public.vincular_cuenta_paciente(text, uuid) from anon;
revoke execute on function public.vincular_cuenta_paciente(text, uuid) from authenticated;
grant execute on function public.vincular_cuenta_paciente(text, uuid) to service_role;

-- ===========================================================================
-- 2. Eliminar la firma de 3 argumentos (consentimiento-app-paciente)
-- ===========================================================================
-- Un overload de 2 argumentos conviviendo con el de 3 es en sí mismo el
-- consent bypass que motivó la firma de 3 argumentos (nada obliga al caller
-- a usar la versión que valida documentos si la vieja sigue viva) — por eso
-- este rollback DROPEA la versión nueva en vez de dejarla coexistir sin uso.

drop function if exists public.vincular_cuenta_paciente(text, uuid, jsonb);
