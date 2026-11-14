-- inicioTratamiento (Epic 1, Task 1.2): el corazón del feature. Dentro del
-- `if public.etapa_plan_completo(p_etapa_id) then` que YA disparaba el OTP,
-- se cuelga el arranque del tratamiento:
--   1. Arranque idempotente e irreversible: fecha_inicio = current_date,
--      estado 'activa', solo si la etapa tenía fecha_inicio Y
--      fecha_finalizacion en NULL (DEC-E1-2: una etapa cerrada que nunca
--      arrancó -- DEC-11 -- NO se resucita).
--   2. Recompute de niveles.fecha_seguimiento_esperada anclada al arranque
--      real, SOLO si arrancó recién en este guardado (DEC-4). Un re-guardado
--      sobre una etapa ya activa no re-agenda nada.
--   3. El return del paciente_id sigue ocurriendo cada vez que el plan está
--      completo, arrancado o no (DEC-E1-1) -- es el único mecanismo de
--      reintento del OTP que existe (useSetEntregasPlan es el único caller
--      de dispararInvitacion; no hay reenvío manual en la UI).
--
-- CONTRATO CRÍTICO: el gate es la llamada a public.etapa_plan_completo
-- (el seam de slots). Su regla NUNCA se inlinea acá -- feat/frases-automaticas
-- la va a redefinir de 3 a 2 slots; inlinearla acá dejaría el plan
-- eternamente incompleto tras ese merge (deadlock silencioso, sin OTP).
--
-- Arranque y disparo del OTP ocurren en la misma transacción implícita de
-- la función -- imposible que uno ocurra sin el otro.
--
-- `db diff` está ROTO en este ambiente (mismo bug preexistente documentado
-- en 20260712040000_inicio_tratamiento_fundacion.sql). Esta migración fue
-- hand-authored. Excepción declarada a
-- .claude/supabase-declarative-database-schema.md §3.

create or replace function public.set_entregas_plan(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id  uuid;
  v_paciente_id   uuid;
  v_estado_activa uuid;
  v_arrancada     integer;
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
    -- 1. Arranque: idempotente (fecha_inicio is null) e irreversible.
    --    fecha_finalizacion is null: NO se resucita una etapa cerrada (DEC-E1-2).
    select ee.id into v_estado_activa
      from public.estados_etapa as ee
     where ee.codigo = 'activa';

    update public.etapas_tratamiento
       set fecha_inicio = current_date,
           estado_id    = v_estado_activa
     where id = p_etapa_id
       and fecha_inicio is null
       and fecha_finalizacion is null;

    get diagnostics v_arrancada = row_count;

    -- 2. Recompute de la agenda: SOLO si arrancó recién (DEC-4).
    if v_arrancada = 1 then
      update public.niveles as n
         set fecha_seguimiento_esperada =
               (current_date + (n.numero_nivel * interval '1 month'))::date
       where n.etapa_id = p_etapa_id;
    end if;

    -- 3. Devolver el paciente_id (comportamiento EXISTENTE, no se toca — DEC-E1-1).
    select e.paciente_id into v_paciente_id
      from public.etapas_tratamiento as e
     where e.id = p_etapa_id;

    return v_paciente_id;
  end if;

  return null;
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 3 slots, via etapa_plan_completo), arranca el tratamiento de forma idempotente e irreversible (fecha_inicio = current_date, estado ''activa'', solo si fecha_inicio y fecha_finalizacion eran NULL — DEC-E1-2 evita resucitar una etapa cerrada) y, si arrancó recién, recomputa fecha_seguimiento_esperada de los niveles anclada al arranque real (DEC-4). Siempre que el plan está completo devuelve el paciente_id, arrancado o no, para que el web console dispare la emisión+entrega del OTP de activación (EF paciente-invitacion) — el reintento del OTP depende de este return no acoplarse al arranque (DEC-E1-1); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
