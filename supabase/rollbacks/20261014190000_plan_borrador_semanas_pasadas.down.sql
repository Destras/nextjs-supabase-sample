-- Rollback de 20261014190000_plan_borrador_semanas_pasadas.sql: vuelve al set_entregas_plan de la Task 0.1
-- (full-replace sin bloqueo de semanas pasadas).

-- ---------------------------------------------------------------------------
-- set_entregas_plan
-- ---------------------------------------------------------------------------
-- Guarda el plan de entregas de una etapa (full-replace) en una transacción
-- atómica. GUARDAR NUNCA ARRANCA EL TRATAMIENTO (planBorrador, D-1): acepta
-- cualquier plan, incluso vacío o parcial, y no toca fecha_inicio, estado ni
-- niveles. El arranque es un acto propio: public.iniciar_tratamiento.
--   1. Resuelve la etapa con lock (etapa_inexistente) y verifica "admin o dueño".
--   2. Rechaza una etapa cerrada (etapa_cerrada, P0001 — DEC-04).
--   3. Valida el mapa tipo-por-orden (DEC-8). Corre ANTES del delete: si falla,
--      el plan guardado del terapeuta nunca se toca.
--   4. Borra todas las filas existentes de entregas_plan para la etapa e
--      inserta las del JSONB recibido.
--   Devuelve void. (DEC-01: un panel viejo en caché que lee `data` como
--   pacienteId recibe null, igual que hoy con un plan incompleto.)
--
-- El JSONB debe ser un array de objetos con:
--   semana       integer  (1-based; dia_offset = (semana - 1) * 7)
--   orden        integer
--   contenido_id text     (uuid | '' | null)
--
-- contenido_id es obligatorio (entregas_plan.contenido_id not null,
-- frasesAutomaticas/Task 4.1): un item sin contenido_id aborta la transacción
-- entera por violación de esa constraint. La frase ya no es un slot que este
-- RPC persista — es derivada/automática (frases_de_etapa).
--
-- Acceso: el terapeuta dueño de la etapa (etapas_tratamiento.terapeuta_id)
-- o un admin. Escritura exclusivamente via security definer; la RLS de
-- entregas_plan permanece select-only.
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
  v_terapeuta_id      uuid;
  v_fecha_finalizacion date;
begin
  -- 1. Resolver la etapa (con lock, para serializar contra un cierre o un
  --    inicio simultáneo) y obtener el terapeuta dueño.
  select e.terapeuta_id, e.fecha_finalizacion
    into v_terapeuta_id, v_fecha_finalizacion
    from public.etapas_tratamiento as e
   where e.id = p_etapa_id
     for update;

  if not found then
    raise exception 'etapa_inexistente' using errcode = 'P0002';
  end if;

  -- 2. Verificar autorización: terapeuta dueño o admin.
  -- Guard "admin o dueño" (seguridadPanel / SEG-008), el mismo en todos los RPC:
  --   is_admin() or (is_console_user() and <dueño> is not null and auth.uid() = <dueño>)
  -- is_console_user() deja afuera a un terapeuta desactivado con el token
  -- todavía vigente y nunca devuelve NULL. El `is not null` cierra el otro
  -- NULL: si el dueño no resuelve, `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO.
  if not (
    public.is_admin()
    or (public.is_console_user() and v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Una etapa cerrada no se edita (DEC-04).
  if v_fecha_finalizacion is not null then
    raise exception 'etapa_cerrada' using errcode = 'P0001';
  end if;

  -- 4. Validación tipo-por-orden (DEC-8). El mapa de slots debe espejar
  --    SLOT_DEFINITIONS en app/controllers/Tratamiento/utils/slotDefinitions.ts.
  --    Corre ANTES del delete para no tocar el plan guardado si falla. El
  --    `case` no tiene `else`: un orden fuera de 1..5 da null, y
  --    `is distinct from` hace que null-vs-cualquier-cosa sea true → también
  --    lanza. Slots desconocidos se rechazan, no se ignoran.
  if exists (
    select 1
      from jsonb_array_elements(p_entregas_plan) as item
      join public.contenidos as c
        on c.id = nullif(item ->> 'contenido_id', '')::uuid
     where c.tipo is distinct from (
             case (item ->> 'orden')::int
               when 1 then 'video'
               when 2 then 'audio'
               when 3 then 'egregor'
               when 4 then 'cma'
               when 5 then 'ic'
             end
           )
  ) then
    raise exception 'tipo_slot_invalido' using errcode = '23514';
  end if;

  -- 5. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  --    ⚠️ Las filas se recrean con fecha_entregada/fecha_consumida en NULL.
  --    Hoy nadie escribe esas columnas, así que no se pierde nada (BETA-002,
  --    pulidoBeta). El bloqueo de semanas pasadas lo agrega
  --    epic-1-asignar-contenido (Task 1.1); acá todavía es full-replace.
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
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Guarda el plan de entregas de una etapa (full-replace) y NUNCA arranca el tratamiento (planBorrador, D-1): acepta cualquier plan, incluso vacío o parcial, y no toca fecha_inicio, estado ni niveles; el arranque es public.iniciar_tratamiento. Valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego borra las filas previas e inserta las del JSONB recibido. Lanza etapa_inexistente (P0002) y etapa_cerrada (P0001) si la etapa ya terminó. Devuelve void. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;
revoke execute on function public.set_entregas_plan(uuid, jsonb) from public, anon;
