-- =====================================================================
-- Retiro del camino manual de frases — frasesAutomaticas Task 4.1
-- =====================================================================
-- Este epic no agrega nada, borra: la tabla del banco de frases, las 5 RPC
-- que la administraban, y la columna donde entregas_plan guardaba la frase
-- elegida a mano. Todo quedó sin consumidor una vez que epic-1 (nadie la
-- escribe) y epic-2 (nadie la lee — get_mi_plan_semanal, Task 2.2) cerraron.
--
-- Orden crítico dentro de esta migración (DEC-4-1 + DEC-4-3):
--   1. DELETE de las filas de frase en entregas_plan — ANTES de tocar la
--      columna. Esas filas tienen contenido_id en NULL (el CHECK viejo era
--      un XOR), así que la restricción nueva (contenido_id not null) las
--      rechazaría y el ALTER TABLE fallaría a mitad de camino.
--   2. DROP de las 5 RPC de frase (create_frase, update_frase, delete_frase,
--      replace_and_delete_frase, count_frase_usage). Las RPC de contenido
--      NO se tocan.
--   3. ALTER TABLE entregas_plan: drop del CHECK entrega_contenido_xor_frase,
--      contenido_id pasa a NOT NULL, drop de la columna frase_id.
--   4. DROP TABLE frases_motivacionales.
--   5. CREATE OR REPLACE de set_entregas_plan: seguía insertando frase_id
--      (columna que este mismo archivo borra en el paso 3) a partir de un
--      campo que el front ya no envía desde epic-1/Task 1.2. No es un
--      consumidor real — es un parámetro muerto — pero si no se actualiza
--      acá, el guardado de plan de tratamiento rompe en producción con
--      "column frase_id does not exist" la primera vez que alguien lo llame
--      después de este deploy. Verificado en vivo (rollback transaction)
--      que DROP COLUMN no falla por dependencia contra esta función: los
--      cuerpos plpgsql no quedan trackeados en pg_depend, así que la única
--      red de seguridad real para el olvido de esta función era este mismo
--      chequeo manual, no el motor.
--
-- Nota: los DML (paso 1) no los captura `supabase db diff` aunque
-- estuviera sano en este repo (no lo está); van sí o sí a mano.
-- =====================================================================

-- 1. Borrar filas de frase, antes de tocar la columna (DEC-4-1).
delete from public.entregas_plan where frase_id is not null;

-- 2. Borrar las 5 RPC de frase.
drop function if exists public.create_frase(text, text, text);
drop function if exists public.update_frase(uuid, text, text, text);
drop function if exists public.delete_frase(uuid);
drop function if exists public.replace_and_delete_frase(uuid, uuid);
drop function if exists public.count_frase_usage(uuid);

-- 3. entregas_plan: fuera el CHECK xor y la columna; contenido_id obligatorio.
alter table public.entregas_plan
  drop constraint entrega_contenido_xor_frase;

alter table public.entregas_plan
  alter column contenido_id set not null;

alter table public.entregas_plan
  drop column frase_id;

comment on table public.entregas_plan is 'Plan real del paciente: cada fila es una pieza de contenido (video/audio) entregable por semana. La frase de la semana ya no vive acá (frasesAutomaticas): se deriva de la causa/algoritmo de la etapa.';

-- 4. Borrar la tabla del banco de frases.
drop table public.frases_motivacionales;

-- 5. set_entregas_plan: fuera frase_id de la columna de insert y del JSONB
--    de entrada (dead parameter — el front ya no lo manda desde Task 1.2).
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

  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, orden)
  select
    p_etapa_id,
    ((item ->> 'semana')::int - 1) * 7,
    nullif(item ->> 'contenido_id', '')::uuid,
    (item ->> 'orden')::int
  from jsonb_array_elements(p_entregas_plan) as item;
  -- contenido_id not null valida cada fila; un item sin contenido_id
  -- aborta la transacción entera.

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
  'Full-replace del plan de entregas de una etapa: borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 2 slots persistibles: video + mantra), devuelve el paciente_id para que el web console dispare la emisión+entrega del OTP de activación (EF paciente-invitacion); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
