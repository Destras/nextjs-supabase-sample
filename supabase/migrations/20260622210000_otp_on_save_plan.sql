-- ---------------------------------------------------------------------------
-- Migration: otp_on_save_plan
-- ---------------------------------------------------------------------------
-- Enganche atómico de la generación del OTP de activación al guardado del plan
-- de entregas (set_entregas_plan), gateado por la completitud del plan.
--
-- Cambios:
--   1. Nueva función public.etapa_plan_completo(uuid) → boolean
--      Helper privado que verifica si todas las semanas del plan tienen los
--      3 slots (órdenes 1, 2, 3). Espeja la regla del front:
--        total_semanas = coalesce(cantidad_sesiones, cantidad_niveles * 4)
--      Privada: sin grant a authenticated ni service_role.
--
--   2. Recreación de public.set_entregas_plan(uuid, jsonb) con:
--      - Nueva variable v_paciente_id uuid en el bloque declare.
--      - Bloque al final del cuerpo: si etapa_plan_completo(p_etapa_id),
--        resuelve paciente_id desde etapas_tratamiento y llama
--        perform public.generar_otp_activacion(v_paciente_id), descartando
--        el plaintext (§6.3 DevSpec). Atómico con el guardado (misma tx).
--
-- Nota (DEC-E0-3): supabase db diff NO emite security definer, set search_path,
-- grants ni revokes de funciones. Se incluyen manualmente aquí siguiendo el
-- precedente de las migraciones 20260622191557_otps_activacion.sql y
-- 20260622200000_otps_generacion.sql.
-- Docker no disponible en WSL2 → migración hand-crafted.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- etapa_plan_completo
-- ---------------------------------------------------------------------------
-- Verifica si el plan de entregas de una etapa está completo:
--   * Total de semanas = coalesce(cantidad_sesiones, cantidad_niveles * 4)
--     (espeja semanasDeModalidad.ts del front)
--   * Una semana está completa si tiene los 3 slots: orden 1, 2 y 3
--     (espeja isSemanaCompleta en semanaCompleteness.ts del front)
--   * El plan está completo si todas las semanas del total están completas.
-- Retorna false si no puede resolver la modalidad (etapa inexistente).
-- Privada: sin grant a roles externos; la llama set_entregas_plan (definer).
-- ---------------------------------------------------------------------------

create or replace function public.etapa_plan_completo(p_etapa_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total     integer;
  v_completas integer;
begin
  -- Total de semanas = regla del front: cantidad_sesiones, fallback cantidad_niveles*4.
  select coalesce(m.cantidad_sesiones, m.cantidad_niveles * 4)
    into v_total
    from public.etapas_tratamiento as e
    join public.modalidades as m on m.id = e.modalidad_id
   where e.id = p_etapa_id;

  if v_total is null then
    return false;
  end if;

  -- Una semana (dia_offset / 7) está completa si tiene las 3 entregas:
  -- orden 1 (video), 2 (audio) y 3 (frase) — el mismo invariante de 3 slots
  -- que enforce el front (isSemanaCompleta en semanaCompleteness.ts).
  select count(*)
    into v_completas
    from (
      select ep.dia_offset / 7 as semana
        from public.entregas_plan as ep
       where ep.etapa_id = p_etapa_id
         and ep.orden in (1, 2, 3)
       group by ep.dia_offset / 7
      having count(distinct ep.orden) = 3
    ) as t;

  return v_completas = v_total;
end;
$$;

comment on function public.etapa_plan_completo(uuid) is
  'Verifica si el plan de entregas de una etapa está completo: todas las semanas (coalesce(cantidad_sesiones, cantidad_niveles*4)) tienen los 3 slots (órdenes 1, 2, 3). Espeja la regla de completitud del front. Privada: la invoca set_entregas_plan.';

-- Sin grant: privada (la llama set_entregas_plan, que corre como definer).
-- authenticated y anon no necesitan acceso directo.
revoke execute on function public.etapa_plan_completo(uuid) from public;

-- ---------------------------------------------------------------------------
-- set_entregas_plan (recreación con enganche OTP)
-- ---------------------------------------------------------------------------
-- Full-replace del plan de entregas + disparo del OTP de activación cuando
-- el plan queda completo. Todo en la transacción implícita de la función.
-- Preserva todo el comportamiento anterior; solo se añade:
--   * v_paciente_id uuid en el bloque declare.
--   * Bloque al final: gate por etapa_plan_completo + perform generar_otp_activacion.
-- Acceso: el terapeuta dueño de la etapa o un admin. Sin cambio.
-- ---------------------------------------------------------------------------

create or replace function public.set_entregas_plan(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default '[]'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
  v_paciente_id  uuid;
begin
  -- 1. Resolver la etapa y obtener el terapeuta dueño.
  select e.terapeuta_id into v_terapeuta_id
    from public.etapas_tratamiento as e
   where e.id = p_etapa_id;

  if not found then
    raise exception 'etapa_inexistente' using errcode = 'P0002';
  end if;

  -- 2. Verificar autorización: terapeuta dueño o admin.
  if not (public.is_admin() or auth.uid() = v_terapeuta_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  delete from public.entregas_plan
   where etapa_id = p_etapa_id;

  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, frase_id, orden)
  select
    p_etapa_id,
    ((item ->> 'semana')::int - 1) * 7,
    nullif(item ->> 'contenido_id', '')::uuid,
    nullif(item ->> 'frase_id', '')::uuid,
    (item ->> 'orden')::int
  from jsonb_array_elements(p_entregas_plan) as item;
  -- El CHECK entrega_contenido_xor_frase valida XOR por fila;
  -- un item mal formado aborta la transacción entera.

  -- 4. Generación del OTP de activación: solo cuando el plan quedó completo
  --    para todas las semanas (DEC-E1-2). Idempotente y atómica con el guardado.
  --    generar_otp_activacion es no-op si el paciente ya tiene cuenta o tiene
  --    un OTP active vigente (no duplica). El plaintext se descarta (§6.3).
  if public.etapa_plan_completo(p_etapa_id) then
    select e.paciente_id
      into v_paciente_id
      from public.etapas_tratamiento as e
     where e.id = p_etapa_id;

    perform public.generar_otp_activacion(v_paciente_id);
  end if;
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: borra las filas previas e inserta las del JSONB recibido. Cuando el plan queda completo (todas las semanas con sus 3 slots), dispara generar_otp_activacion de forma atómica e idempotente. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
