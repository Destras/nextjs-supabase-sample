-- pacienteOtpIntegracion / Epic 1 — tarea 3.
--
-- set_entregas_plan deja de emitir el OTP inline (antes: `perform
-- generar_otp_activacion`, que generaba el plaintext dentro de la transacción de DB
-- y lo descartaba). La emisión se mueve a un boundary de Edge Function porque Postgres
-- no puede llamar a la Meta Cloud API y el plaintext debe entregarse por WhatsApp
-- (DevSpec §9.2). Ahora la función DEVUELVE el paciente_id cuando el plan quedó
-- completo, para que el web console dispare la EF paciente-invitacion; null si no.
--
-- Cambiar el tipo de retorno (void → uuid) requiere DROP + CREATE (no `create or
-- replace`) y re-aplicar el grant a `authenticated`.

drop function if exists public.set_entregas_plan(uuid, jsonb);

create function public.set_entregas_plan(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default '[]'
)
returns uuid
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

  -- 4. Si el plan quedó completo para todas las semanas (DEC-E1-2), devolver el
  --    paciente_id para que el web console dispare la emisión+entrega del OTP de
  --    activación vía la Edge Function paciente-invitacion. La emisión ya NO ocurre
  --    acá: Postgres no puede llamar a la Meta Cloud API y el plaintext del OTP debe
  --    entregarse por WhatsApp desde un boundary de Edge Function (DevSpec §9.2).
  --    La idempotencia (no duplicar OTP) la garantiza generar_otp_activacion en la EF.
  if public.etapa_plan_completo(p_etapa_id) then
    select e.paciente_id
      into v_paciente_id
      from public.etapas_tratamiento as e
     where e.id = p_etapa_id;

    return v_paciente_id;
  end if;

  return null;
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 3 slots), devuelve el paciente_id para que el web console dispare la emisión+entrega del OTP de activación (EF paciente-invitacion); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
