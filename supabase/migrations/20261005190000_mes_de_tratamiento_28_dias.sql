-- pulidoBeta / BETA-018 — un mes de tratamiento son 28 días, no un mes calendario.
--
-- ADR 0011 (docs/adr/0011-un-mes-de-tratamiento-son-4-semanas.md): el panel
-- contaba el tiempo con dos reglas a la vez — el contenido en semanas, pero el
-- "mes de tratamiento", la fecha de evaluación de cada nivel y las alertas en
-- meses calendario. Resultado: "Mes 1 · Semana 5" en la ficha y una evaluación de
-- cierre ~9 días después de terminado el contenido (día ~121 vs 112).
--
-- Regla única desde acá: mes de tratamiento = bloque de 28 días desde
-- etapas_tratamiento.fecha_inicio.
--   - la evaluación del nivel n vence en fecha_inicio + 28 * n
--   - mes_actual = (current_date - fecha_inicio) / 28 + 1 (división entera),
--     topado en modalidades.cantidad_niveles
--
-- Qué cambia:
--   1. update_etapa_diagnostico   — la grilla regenerada al cambiar modalidad.
--   2. set_entregas_plan          — el recompute al arrancar el tratamiento.
--   3. derive_alertas_activas     — mes_actual (mes_3 / fin) y reinicio
--                                   (primeros 28 días, ya no "mes calendario
--                                   en curso").
--   4. get_admin_dashboard_stats  — mes_actual (en_mes_3, fin_tratamiento,
--                                   distribucionMes). El contrato jsonb NO cambia.
--   5. Datos: fecha_seguimiento_esperada de los niveles pendientes de las
--      etapas en curso.
--
-- Qué NO cambia: firmas, security definer, search_path, grants/revokes y la
-- forma de lo que devuelve cada función; totales.nuevos_mes (KPI de mes
-- calendario real); los niveles ya evaluados (son historia).
--
-- ⚠️ Al aplicarla cambian las fechas de evaluación y las alertas (eval_vencida
-- por arrastre, mes_3, fin, reinicio) de los pacientes en curso. Avisar antes de
-- deployar.
--
-- Escrita a mano (`db diff` no corre en este repo). Los cuerpos espejan
-- supabase/schemas/71_rpcs_pacientes.sql, 65_alertas.sql y 62_rpc_admin.sql.

-- ---------------------------------------------------------------------------
-- 1. update_etapa_diagnostico
-- ---------------------------------------------------------------------------

create or replace function public.update_etapa_diagnostico(
  p_paciente_id  uuid,
  p_causa_id     uuid,
  p_algoritmo_id uuid,
  p_modalidad_id uuid,
  p_bloqueo_ids  uuid[],
  p_alfabetos    jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id           uuid;
  v_terapeuta_id       uuid;
  v_modalidad_anterior uuid;
  v_cantidad_niveles   integer;
  v_fecha_inicio       date;
begin
  -- 1. Resolver la etapa activa (fecha_finalizacion IS NULL = en curso).
  -- order by + limit 1 para ser determinístico: si por una anomalía de datos
  -- hubiera más de una etapa sin fecha_finalizacion, tomamos la más reciente
  -- en lugar de una fila arbitraria (no hay índice único que lo garantice).
  -- coalesce(fecha_inicio, created_at) desc, no fecha_inicio desc a secas:
  -- en Postgres `desc` es NULLS FIRST, y una etapa sin arrancar (fecha_inicio
  -- null) no debe flotar al tope solo por eso.
  select et.id, et.terapeuta_id, et.modalidad_id, et.fecha_inicio
    into v_etapa_id, v_terapeuta_id, v_modalidad_anterior, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'etapa_activa_no_encontrada'
      using errcode = 'P0002',
            detail  = 'el paciente no tiene una etapa de tratamiento activa';
  end if;

  -- 2. Autorizar contra el terapeuta dueño de la etapa.
  -- Comparación NULL-safe: si v_terapeuta_id no resuelve (paciente sin
  -- asignación ni etapa activa), `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue permitiendo
  -- al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Gate de frescura: bloquear si la etapa ya tiene progreso.
  if exists (
        select 1
          from public.niveles as n
         where n.etapa_id = v_etapa_id
           and n.fecha_seguimiento_real is not null
      )
     or exists (
        select 1
          from public.nivel_evaluacion as ne
          join public.niveles as n on n.id = ne.nivel_id
         where n.etapa_id = v_etapa_id
      )
     or exists (
        select 1
          from public.entregas_plan as ep
         where ep.etapa_id = v_etapa_id
           and ep.fecha_entregada is not null
      ) then
    raise exception 'etapa_con_progreso'
      using errcode = 'P0001',
            detail  = 'la etapa ya tiene progreso (niveles cursados o evaluaciones); corregir el diagnóstico requiere un re-diagnóstico, no esta edición';
  end if;

  -- 4. Pre-chequear la modalidad para un error descriptivo y obtener su
  --    cantidad_niveles (necesaria si hay que regenerar la grilla).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  -- 5. Actualizar el snapshot de diagnóstico de la etapa.
  update public.etapas_tratamiento
     set causa_id     = p_causa_id,
         algoritmo_id = p_algoritmo_id,
         modalidad_id = p_modalidad_id
   where id = v_etapa_id;

  -- 6. Reemplazar bloqueos (delete + bulk insert; array vacío/NULL = 0 filas).
  delete from public.etapa_bloqueos where etapa_id = v_etapa_id;
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 7. Reemplazar alfabetos (delete + bulk insert via jsonb_array_elements;
  --    jsonb vacío ('[]') genera 0 filas, igual que bloqueos).
  delete from public.etapa_alfabetos where etapa_id = v_etapa_id;
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         nullif(item ->> 'numero', '')::int
    from jsonb_array_elements(p_alfabetos) as item;

  -- 8. Regenerar niveles SOLO si cambió la modalidad. Seguro por el gate.
  --    Fechas ancladas a v_fecha_inicio (fecha real de la etapa), NO a current_date,
  --    porque la etapa ya existe y tiene su propia fecha de inicio (DEC-0-4).
  --    Un mes de tratamiento son 28 días, no un mes calendario (ADR 0011):
  --    la evaluación del nivel n vence en fecha_inicio + 28 * n.
  if v_modalidad_anterior is distinct from p_modalidad_id then
    delete from public.niveles where etapa_id = v_etapa_id;
    insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
    select v_etapa_id, g.n, v_fecha_inicio + 28 * g.n
      from generate_series(1, v_cantidad_niveles) as g(n);
  end if;
end;
$$;

comment on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], jsonb) is
  'Corrige el diagnóstico/plan de la etapa activa in-place (causa, algoritmo, modalidad, bloqueos, alfabetos). p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: terapeuta de la etapa o admin. Gate de frescura: solo si la etapa no tiene progreso. Cambiar modalidad regenera la grilla de niveles (fecha_seguimiento_esperada = fecha_inicio + 28 * numero_nivel: un mes de tratamiento son 28 días, ADR 0011).';


grant execute on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. set_entregas_plan
-- ---------------------------------------------------------------------------

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

  -- 3. Validación tipo-por-orden (DEC-8). El mapa de slots debe espejar
  --    SLOT_DEFINITIONS en app/controllers/Tratamiento/utils/slotDefinitions.ts
  --    y public.etapa_plan_completo (71_rpcs_pacientes.sql). Corre ANTES del
  --    delete: plpgsql hace rollback igual ante una excepción, pero fallar acá
  --    primero evita que el plan guardado del terapeuta desaparezca aunque
  --    sea momentáneamente, y cuesta un solo query en vez de
  --    delete + insert + rollback. El `case` no tiene `else`: un orden fuera
  --    de 1..5 da null, y `is distinct from` hace que null-vs-cualquier-cosa
  --    sea true → también lanza. Slots desconocidos se rechazan, no se
  --    ignoran.
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

  -- 4. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  --    ⚠️ Las filas se recrean con fecha_entregada/fecha_consumida en NULL.
  --    Hoy nadie escribe esas columnas, así que no se pierde nada (BETA-002,
  --    pulidoBeta). Antes de que algo empiece a escribirlas, este guardado
  --    tiene que dejar de ser full-replace o cada edición borra el historial.
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

  -- 5. Si el plan quedó completo para todas las semanas (DEC-E1-2), devolver el
  --    paciente_id para que el web console dispare la invitación vía la Edge
  --    Function paciente-invitacion, que entrega la bienvenida post-activación
  --    (activacionPorTelefono, Epic 3). Esa EF ya no emite OTPs: el código de
  --    activación lo pide el paciente desde la app (request-otp). El envío no
  --    ocurre acá: Postgres no puede llamar a la
  --    Meta Cloud API, así que la entrega por WhatsApp vive en ese boundary de
  --    Edge Function (DevSpec §9.2). La idempotencia (no duplicar OTP / no
  --    reentregar la bienvenida) la garantiza esa EF, no este RPC.
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

    -- 2. Recompute de la agenda: SOLO si arrancó recién (DEC-4). Un mes de
    --    tratamiento son 28 días, no un mes calendario (ADR 0011): la
    --    evaluación del nivel n vence el día 28 * n desde el arranque.
    if v_arrancada = 1 then
      update public.niveles as n
         set fecha_seguimiento_esperada = current_date + 28 * n.numero_nivel
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
  'Full-replace del plan de entregas de una etapa: valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 5 slots persistibles — via etapa_plan_completo; la frase dejó de ser una entrega asignable en frasesAutomaticas, se deriva de causa+algoritmo+semana), arranca el tratamiento de forma idempotente e irreversible (fecha_inicio = current_date, estado ''activa'', solo si fecha_inicio y fecha_finalizacion eran NULL — DEC-E1-2 evita resucitar una etapa cerrada) y, si arrancó recién, recomputa fecha_seguimiento_esperada de los niveles anclada al arranque real (DEC-4): current_date + 28 * numero_nivel (un mes de tratamiento son 28 días, ADR 0011). Siempre que el plan está completo devuelve el paciente_id, arrancado o no, para que el web console dispare la invitación (EF paciente-invitacion), que entrega la bienvenida post-activación (activacionPorTelefono Epic 3; el OTP lo pide el paciente desde la app) — el reintento depende de este return no acoplarse al arranque (DEC-E1-1); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';


grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. derive_alertas_activas
-- ---------------------------------------------------------------------------

create or replace function public.derive_alertas_activas()
returns table (
  paciente_id      uuid,
  paciente_nombre  text,
  terapeuta_id     uuid,
  terapeuta_nombre text,
  tipo             text,
  evento_ref       text,
  valor            int,
  fecha            timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  with activos as (
    -- pacientes con al menos una asignación activa
    select distinct ap.paciente_id
      from public.asignaciones_paciente ap
     where ap.fecha_hasta is null
  ),
  terapeuta_activo as (
    -- terapeuta con la asignación activa de cada paciente (1 fila por
    -- paciente, garantizado por el índice único parcial
    -- asignaciones_paciente_activa_idx)
    select ap.paciente_id,
           ap.terapeuta_id
      from public.asignaciones_paciente ap
     where ap.fecha_hasta is null
  ),
  etapas_ranked as (
    -- ordinal del ciclo por paciente (1,2,3…), ordenado por
    -- coalesce(fecha_inicio, created_at::date) con desempate determinista
    -- por id. El ::date colapsa el timestamptz a día calendario para
    -- comparar igual que el TS (etapaOrdinal.ts). Sin el coalesce, una
    -- etapa cerrada que nunca arrancó (DEC-11) ordenaría última (los NULL
    -- van al final en asc) y el "tratamiento 1" figuraría como el 2. Igual
    -- criterio que get_admin_dashboard_stats.
    select et.id,
           et.paciente_id,
           et.modalidad_id,
           et.fecha_inicio,
           et.fecha_finalizacion,
           et.created_at,
           row_number() over (
             partition by et.paciente_id
             order by coalesce(et.fecha_inicio, et.created_at::date), et.id
           ) as etapa_ordinal
      from public.etapas_tratamiento et
     where et.paciente_id in (select paciente_id from activos)
  ),
  etapa_activa as (
    -- SOLO las arrancadas (fecha_finalizacion is null y fecha_inicio is not
    -- null) → alimenta eval_vencida/mes_3/fin/reinicio/medicion_cierre_pendiente.
    -- El filtro fecha_inicio is not null va ACÁ, antes del cálculo de
    -- mes_actual (ver nota arriba sobre greatest(1, NULL) = 1). Post-DEC-12:
    -- colapsada directo sobre etapas_ranked (ya no hay etapa_sin_iniciar que
    -- justifique la CTE intermedia etapas_abiertas).
    --
    -- semanas (medir-chakras): public.semanas_de_etapa(er.id), evaluada UNA
    -- vez por fila acá en vez de adentro de la branch medicion_cierre_pendiente
    -- — la función es security definer así que es invocable pese a ser
    -- privada (mismo mecanismo que ya usa esta CTE para el resto).
    --
    -- mes_actual (ADR 0011): un mes de tratamiento son 28 días desde
    -- fecha_inicio, no un mes calendario. date - date da días (integer) y la
    -- división entera los parte en bloques: días 0–27 → mes 1, 28–55 → mes 2…
    -- Espeja mesActual.ts (ceil(semana / 4)).
    select er.id            as etapa_id,
           er.paciente_id,
           er.etapa_ordinal::int as etapa_ordinal,
           er.fecha_inicio,
           m.cantidad_niveles,
           public.semanas_de_etapa(er.id) as semanas,
           least(
             m.cantidad_niveles,
             greatest(
               1,
               (current_date - er.fecha_inicio) / 28 + 1
             )
           ) as mes_actual
      from etapas_ranked er
      join public.modalidades m on m.id = er.modalidad_id
     where er.fecha_finalizacion is null
       and er.fecha_inicio is not null
  ),
  derivadas as (
    -- score_bajo: última nivel_evaluacion del paciente (cross-etapa, max
    -- fecha_respuesta) con score <= 3.
    select a.paciente_id,
           p.nombre                as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre             as terapeuta_nombre,
           'score_bajo'            as tipo,
           ultimo.id::text         as evento_ref,
           ultimo.score            as valor,
           ultimo.fecha_respuesta  as fecha
      from activos a
      join public.pacientes p on p.id = a.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = a.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
      join lateral (
        select ev.id, ev.score, ev.fecha_respuesta
          from public.nivel_evaluacion   ev
          join public.niveles            n  on n.id  = ev.nivel_id
          join public.etapas_tratamiento et on et.id = n.etapa_id
         where et.paciente_id = a.paciente_id
         order by ev.fecha_respuesta desc
         limit 1
      ) ultimo on true
     where ultimo.score <= 3

    union all

    -- eval_vencida: nivel más viejo sin nivel_evaluacion de la etapa activa
    -- cuya fecha_seguimiento_esperada ya pasó (el más antiguo cuando hay
    -- varios vencidos). Decidido por FECHA (D-1), no por índice de mes: el
    -- criterio anterior (numero_nivel <= mes_actual) contaba el mes en curso
    -- como ya vencido. Doble protección: los niveles con
    -- fecha_seguimiento_esperada = NULL (de una etapa sin arrancar) nunca
    -- matchean el `<`, aunque el filtro de etapa_activa fallara. El
    -- "join lateral ... on true" es inner: si no hay ningún nivel vencido sin
    -- evaluar, la subconsulta no devuelve filas y el paciente se descarta (no
    -- emite fila con evento_ref nulo).
    select ea.paciente_id,
           p.nombre                                          as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre                                       as terapeuta_nombre,
           'eval_vencida'                                     as tipo,
           vencido.id::text                                   as evento_ref,
           null::int                                          as valor,
           vencido.fecha_seguimiento_esperada::timestamptz    as fecha
      from etapa_activa ea
      join public.pacientes p on p.id = ea.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = ea.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
      join lateral (
        select n.id, n.fecha_seguimiento_esperada
          from public.niveles n
         where n.etapa_id = ea.etapa_id
           and n.fecha_seguimiento_esperada < current_date
           and not exists (
             select 1 from public.nivel_evaluacion ev where ev.nivel_id = n.id
           )
         order by n.fecha_seguimiento_esperada asc
         limit 1
      ) vencido on true

    union all

    -- mes_3: etapa activa con mes_actual = 3.
    select ea.paciente_id,
           p.nombre                      as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre                   as terapeuta_nombre,
           'mes_3'                       as tipo,
           ea.etapa_id::text || ':mes_3' as evento_ref,
           3                             as valor,
           null::timestamptz             as fecha
      from etapa_activa ea
      join public.pacientes p on p.id = ea.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = ea.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
     where ea.mes_actual = 3

    union all

    -- fin: etapa activa en su último mes (mes_actual = cantidad_niveles).
    select ea.paciente_id,
           p.nombre                    as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre                 as terapeuta_nombre,
           'fin'                       as tipo,
           ea.etapa_id::text || ':fin' as evento_ref,
           ea.mes_actual               as valor,
           null::timestamptz           as fecha
      from etapa_activa ea
      join public.pacientes p on p.id = ea.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = ea.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
     where ea.mes_actual = ea.cantidad_niveles

    union all

    -- reinicio: etapa activa no-primera en su primer mes de tratamiento
    -- (menos de 28 días desde el arranque — DEC-31, ADR 0011).
    select ea.paciente_id,
           p.nombre                          as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre                       as terapeuta_nombre,
           'reinicio'                        as tipo,
           ea.etapa_id::text || ':reinicio'  as evento_ref,
           ea.etapa_ordinal                  as valor,
           ea.fecha_inicio::timestamptz      as fecha
      from etapa_activa ea
      join public.pacientes p on p.id = ea.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = ea.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
     where ea.etapa_ordinal >= 2
       and current_date - ea.fecha_inicio < 28

    union all

    -- medicion_cierre_pendiente (medir-chakras, DEC-32/DEC-33): etapa activa
    -- dentro de su última semana de contenido, todavía sin medición de
    -- cierre. semanas_de_etapa = cantidad_niveles * 4; la última semana
    -- arranca en fecha_inicio + (semanas - 1) * 7. Sin techo superior: si la
    -- etapa se pasa de fecha sin cerrarse, la alerta sigue activa hasta que
    -- se cierre (cerrar_etapa/cerrar_etapa_con_medicion, vía
    -- _generar_cierre_automatico, la extinguen al setear fecha_finalizacion
    -- — etapa_activa ya filtra fecha_finalizacion is null arriba, así que
    -- esta alerta se apaga sola).
    select ea.paciente_id,
           p.nombre                                 as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre                              as terapeuta_nombre,
           'medicion_cierre_pendiente'               as tipo,
           ea.etapa_id::text || ':medicion_cierre'   as evento_ref,
           null::int                                 as valor,
           (ea.fecha_inicio + ((ea.semanas - 1) * 7))::timestamptz as fecha
      from etapa_activa ea
      join public.pacientes p on p.id = ea.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = ea.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
     where current_date >= ea.fecha_inicio + ((ea.semanas - 1) * 7)
  )
  select d.paciente_id,
         d.paciente_nombre,
         d.terapeuta_id,
         d.terapeuta_nombre,
         d.tipo,
         d.evento_ref,
         d.valor,
         d.fecha
    from derivadas d
    left join public.alertas_atendidas aa
      on aa.tipo = d.tipo and aa.evento_ref = d.evento_ref and aa.paciente_id = d.paciente_id
   where aa.id is null;
$$;

comment on function public.derive_alertas_activas is
  'Motor compartido del subsistema de alertas: deriva los 6 tipos activos (score_bajo, eval_vencida, mes_3, fin, reinicio, medicion_cierre_pendiente — medir-chakras) restando las atendidas (alertas_atendidas, left join ... where aa.id is null). eval_vencida se decide por fecha_seguimiento_esperada < current_date (no por índice de mes). mes_3/fin/reinicio cuentan el mes de tratamiento en bloques de 28 días desde fecha_inicio, no por calendario (ADR 0011): mes_actual = (current_date - fecha_inicio) / 28 + 1 topado en cantidad_niveles; reinicio dura los primeros 28 días de una etapa no-primera. medicion_cierre_pendiente activa cuando current_date >= fecha_inicio + (semanas_de_etapa - 1) * 7 y NO es descartable (tipos_alerta.descartable = false): se resuelve cerrando la etapa con medición. Las etapas sin arrancar (fecha_inicio is null) no emiten NINGUNA de las 6 (DEC-12 sacó contenido_pendiente, el tipo original que las señalizaba — esa señal vive ahora en el widget "Sin iniciar" del dashboard del terapeuta y en list_terapeutas.sin_iniciar para el admin). Punto único de verdad — lo consumen list_alertas_terapeuta/list_alertas_admin y los counts de get_admin_dashboard_stats/list_terapeutas. Interna: no otorgada a authenticated.';


-- Función interna: NO se otorga a authenticated. `create or replace` conserva el
-- ACL existente, pero los dos revokes se repiten acá para que la función quede
-- privada aunque esta migración corra sobre una base donde no lo estaba (ver
-- 65_alertas.sql: revocar solo de public no alcanza, hay un default privilege
-- que otorga execute a authenticated).
revoke execute on function public.derive_alertas_activas() from public;
revoke execute on function public.derive_alertas_activas() from authenticated;

-- ---------------------------------------------------------------------------
-- 4. get_admin_dashboard_stats
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  with activos as (
    -- pacientes con al menos una asignación activa
    select distinct ap.paciente_id
      from public.asignaciones_paciente ap
     where ap.fecha_hasta is null
  ),
  etapas_ranked as (
    -- ordinal del ciclo por paciente (1,2,3…), ordenado por
    -- coalesce(fecha_inicio, created_at::date) con desempate determinista
    -- por id. El ::date colapsa el timestamptz a día calendario para
    -- comparar igual que el TS (etapaOrdinal.ts). Sin el coalesce, una
    -- etapa que nunca arrancó ordenaría última (los NULL van al final en
    -- asc) y el "tratamiento 1" figuraría como el 2. Igual criterio que
    -- 65_alertas.sql (derive_alertas_activas).
    select et.id,
           et.paciente_id,
           et.modalidad_id,
           et.fecha_inicio,
           et.fecha_finalizacion,
           et.created_at,
           row_number() over (
             partition by et.paciente_id
             order by coalesce(et.fecha_inicio, et.created_at::date), et.id
           ) as etapa_ordinal
      from public.etapas_tratamiento et
     where et.paciente_id in (select paciente_id from activos)
  ),
  paciente_meta as (
    select a.paciente_id,
           pa.fecha_alta,
           -- último score cross-etapa (max fecha_respuesta)
           (
             select ev.score
               from public.nivel_evaluacion   ev
               join public.niveles            n  on n.id  = ev.nivel_id
               join public.etapas_tratamiento et on et.id = n.etapa_id
              where et.paciente_id = a.paciente_id
              order by ev.fecha_respuesta desc
              limit 1
           )                                                            as ultimo_score,
           ea.id                                                        as etapa_activa_id,
           ea.etapa_ordinal,
           ea.fecha_inicio                                              as etapa_inicio,
           m.cantidad_niveles
      from activos a
      join public.pacientes pa on pa.id = a.paciente_id
      -- etapa activa del paciente (la de fecha_finalizacion null)
      left join lateral (
        select er.id, er.modalidad_id, er.etapa_ordinal, er.fecha_inicio
          from etapas_ranked er
         where er.paciente_id = a.paciente_id
           and er.fecha_finalizacion is null
         order by er.fecha_inicio desc, er.id desc
         limit 1
      ) ea on true
      left join public.modalidades m on m.id = ea.modalidad_id
  ),
  paciente_calc as (
    select pm.paciente_id,
           pm.fecha_alta,
           pm.ultimo_score,
           pm.etapa_ordinal,
           -- arrastrado para poder comparar mes_actual = cantidad_niveles
           -- (fin_tratamiento) sin volver a pisar paciente_meta.
           pm.cantidad_niveles,
           -- mes de tratamiento: bloques de 28 días desde el inicio de la
           -- etapa activa (ADR 0011 — 4 semanas, no un mes calendario; date -
           -- date da días y la división entera los parte: 0–27 → mes 1,
           -- 28–55 → mes 2…), base 1, topado en cantidad_niveles (variable
           -- por modalidad, NO hardcodeado 4). Espeja 65_alertas.sql y
           -- mesActual.ts.
           -- OJO: el guard de etapa_activa_id NO alcanza para una etapa creada
           -- pero sin arrancar (fecha_inicio null) — ahí etapa_activa_id SÍ
           -- existe. Sin la rama de etapa_inicio, current_date - NULL es
           -- NULL, pero greatest(1, NULL) devuelve 1 (greatest/least ignoran
           -- nulls en vez de propagarlos), y la etapa reportaría mes_actual=1
           -- en vez de null. Cae sola en el bucket "Sin etapa" de
           -- distribucionMes junto con quien no tiene etapa activa (DEC-3a,
           -- un solo bucket, sin flag sin_iniciar).
           case
             when pm.etapa_activa_id is null then null
             when pm.etapa_inicio    is null then null
             else least(
                    coalesce(pm.cantidad_niveles, 1),
                    greatest(
                      1,
                      (current_date - pm.etapa_inicio) / 28 + 1
                    )
                  )
           end                                                          as mes_actual
      from paciente_meta pm
  )
  select jsonb_build_object(
    'totales', jsonb_build_object(
      'pacientes_activos', (select count(*)::int from paciente_calc),
      'nuevos_mes', (
        select count(*)::int
          from paciente_calc
         where fecha_alta is not null
           and date_trunc('month', fecha_alta) = date_trunc('month', current_date)
      ),
      -- D4: alertas_activas ya NO deriva del score — es el count total del
      -- subsistema derive_alertas_activas() (65_alertas.sql, mismo motor que
      -- list_alertas_admin y list_terapeutas.alertas_activas). int no-nulo
      -- (0 filas = 0 alertas, sin caso NULL vía score).
      'alertas_activas', (
        select count(*)::int from public.derive_alertas_activas()
      ),
      'score_promedio', (
        select round(avg(ultimo_score), 1) from paciente_calc
      ),
      -- decisión de producto: dos counts de distribución por mes de tratamiento, para el
      -- resumen del dashboard admin. fin_tratamiento compara contra
      -- cantidad_niveles (no hardcodea 4) para ser robusto a otras modalidades.
      'en_mes_3', (
        select count(*)::int from paciente_calc where mes_actual = 3
      ),
      'fin_tratamiento', (
        select count(*)::int
          from paciente_calc
         where mes_actual = cantidad_niveles
      )
    ),
    'distribucionEtapa', coalesce((
      select jsonb_agg(jsonb_build_object('label', d.label, 'cantidad', d.cantidad) order by d.orden)
        from (
          select case
                   when pn.etapa_ordinal is null then 'Sin etapa'
                   else pn.etapa_ordinal::text
                 end          as label,
                 count(*)::int as cantidad,
                 coalesce(pn.etapa_ordinal, 2147483647) as orden
            from paciente_calc pn
           group by pn.etapa_ordinal
        ) d
    ), '[]'::jsonb),
    'distribucionMes', (
      -- A diferencia de distribucionEtapa (ordinal sin tope), acá el rango de
      -- meses es conocido (1..cantidad_niveles): se emite SIEMPRE completo,
      -- con 0 en los meses sin pacientes hoy. Si solo agrupáramos por
      -- mes_actual (como antes) el mes vacío desaparecería del jsonb y
      -- deriveProyeccionMesSiguiente perdería el N real (bug: la cohorte del
      -- último mes ocupado se confundía con "cierran tratamiento").
      with meses_totales as (
        -- N = mayor cantidad_niveles entre los pacientes activos (max ignora
        -- null); 0 si nadie tiene etapa activa hoy.
        select coalesce(max(pc.cantidad_niveles), 0) as n
          from paciente_calc pc
      ),
      meses_conteo as (
        -- pacientes por mes de tratamiento, solo meses con dato (no null)
        select pc.mes_actual, count(*)::int as cantidad
          from paciente_calc pc
         where pc.mes_actual is not null
         group by pc.mes_actual
      ),
      meses_serie as (
        -- la serie completa 1..N, exista o no paciente en cada mes
        select gs.mes
          from meses_totales, generate_series(1, meses_totales.n) as gs (mes)
      ),
      sin_etapa_conteo as (
        -- bucket "Sin etapa" (mes_actual null) — no es un mes numérico, se
        -- agrega aparte y solo si hay pacientes en esa condición
        select count(*)::int as cantidad
          from paciente_calc pc
         where pc.mes_actual is null
      )
      select coalesce(
               jsonb_agg(jsonb_build_object('label', d.label, 'cantidad', d.cantidad) order by d.orden),
               '[]'::jsonb
             )
        from (
          select ms.mes::text          as label,
                 coalesce(mc.cantidad, 0) as cantidad,
                 ms.mes                 as orden
            from meses_serie ms
            left join meses_conteo mc on mc.mes_actual = ms.mes
          union all
          select 'Sin etapa'  as label,
                 se.cantidad   as cantidad,
                 2147483647    as orden
            from sin_etapa_conteo se
           where se.cantidad > 0
        ) d
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_dashboard_stats is
  'Agregados globales de la red para el dashboard admin: totales (pacientes activos, nuevos del mes, alertas activas, score promedio, en_mes_3, fin_tratamiento) + distribución por etapa (ordinal del ciclo) y por mes de tratamiento (bloques de 28 días desde fecha_inicio, no mes calendario — ADR 0011). distribucionMes emite SIEMPRE los meses 1..N completos (N = max cantidad_niveles entre pacientes activos), con 0 en los meses sin pacientes hoy, más el bucket "Sin etapa" aparte cuando corresponde — así el consumidor (deriveProyeccionMesSiguiente) conoce el largo real del tratamiento aunque el último mes esté vacío. distribucionEtapa sigue agrupando solo ordinales ocupados (rango no acotado). Ya NO emite distribucionCausa (decisión de producto: esa estadística vive en el diagnóstico). jsonb único. Guarda is_admin(). score_promedio NULL si ningún paciente activo tiene evaluaciones; alertas_activas (D4) es el count de derive_alertas_activas(), siempre int no-nulo. en_mes_3/fin_tratamiento son counts sobre mes_actual, este último comparado contra cantidad_niveles (no hardcodea 4) para ser robusto a otras modalidades. Modelo: etapa = tratamiento de N meses (def. modalidad), 1 eval/mes; etapa_ordinal ⊥ mes_actual. mes_actual es null tanto sin etapa activa como con etapa activa sin arrancar (fecha_inicio null) — cae en el bucket Sin etapa, sin bucket separado (DEC-3a). etapas_ranked ordena por coalesce(fecha_inicio, created_at::date) — espejado con 65_alertas.sql y etapaOrdinal.ts.';


grant execute on function public.get_admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Datos: re-agendar los niveles pendientes de las etapas en curso
-- ---------------------------------------------------------------------------
-- Solo etapas arrancadas y abiertas, y solo niveles sin evaluar: los ya
-- evaluados (fecha_seguimiento_real o una fila en nivel_evaluacion) son historia
-- y conservan su fecha. Idempotente: correrla dos veces deja el mismo resultado.

update public.niveles as n
   set fecha_seguimiento_esperada = e.fecha_inicio + 28 * n.numero_nivel
  from public.etapas_tratamiento as e
 where e.id = n.etapa_id
   and e.fecha_inicio is not null
   and e.fecha_finalizacion is null
   and n.fecha_seguimiento_real is null
   and not exists (select 1 from public.nivel_evaluacion ev where ev.nivel_id = n.id);
