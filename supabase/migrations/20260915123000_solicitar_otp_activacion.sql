-- activacionPorTelefono, Epic 1 Task 1.1 (ADR-0001 vigencia parametrizada +
-- ADR-0002 guardas del pedido del código):
--
-- Hand-written (db diff no funciona en este repo — shadow DB rota, ver
-- supabase/migrations/20260830170100_baja_voluntaria_foundational.sql).
-- Mirrors el estado final de supabase/schemas/22_otps_activacion.sql y
-- supabase/schemas/73_otps_functions.sql.
--
-- Orden:
--   1. otps_activacion: delivered_at + índice + comment de la tabla.
--   2. drop + create de emitir_otp_activacion(uuid) → (uuid, interval).
--   3. create de solicitar_otp_activacion(text) + grants.
--   4. create de marcar_otp_entregado(uuid) + grants.
--   5. create or replace de generar_otp_activacion/regenerar_otp_activacion
--      (vigencia parametrizada + comentarios actualizados).

-- ---------------------------------------------------------------------------
-- 1. otps_activacion: delivered_at + índice + comment.
-- ---------------------------------------------------------------------------

alter table public.otps_activacion
  add column if not exists delivered_at timestamptz;

create index if not exists otps_activacion_paciente_entrega_idx
  on public.otps_activacion (paciente_id, delivered_at);

comment on table public.otps_activacion is 'Códigos de activación OTP hasheados (HMAC-SHA256 + pepper en Vault). RLS lockdown total: solo security definer y service-role pueden acceder. Un único OTP active por paciente y hash único global entre activos. delivered_at (null = nunca entregado) marca cuándo se entregó el código al paciente por WhatsApp; lo setea marcar_otp_entregado y lo usa solicitar_otp_activacion para el tope diario (activacionPorTelefono, Epic 1).';

-- ---------------------------------------------------------------------------
-- 2. emitir_otp_activacion: cambia de firma (uuid) → (uuid, interval).
--    Un create or replace con otro arg crearía un overload, no reemplazaría
--    la función existente: hay que dropearla primero.
-- ---------------------------------------------------------------------------

drop function if exists public.emitir_otp_activacion(uuid);

-- emitir_otp_activacion: implementación omitida en la versión pública.
create or replace function public.emitir_otp_activacion(p_paciente_id uuid, p_vigencia interval)
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

comment on function public.emitir_otp_activacion(uuid, interval) is
  'Flujo de OTP del paciente. Implementación omitida en la versión pública del repositorio.';

revoke execute on function public.emitir_otp_activacion(uuid, interval) from public, authenticated;

-- solicitar_otp_activacion: implementación omitida en la versión pública.
create or replace function public.solicitar_otp_activacion(p_telefono text)
returns table (
  r_resultado   text,
  r_paciente_id uuid,
  r_otp_id      uuid,
  r_codigo      text
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

grant execute on function public.regenerar_otp_activacion(uuid) to service_role;
