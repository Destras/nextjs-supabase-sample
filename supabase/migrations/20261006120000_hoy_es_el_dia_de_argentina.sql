-- =============================================================================
-- pulidoBeta / BETA-031 — "Hoy" es el día de Argentina (ADR 0012)
-- =============================================================================
-- La base calculaba "hoy" con current_date, que es el día UTC (no hay timezone
-- configurada). El panel cuenta con el día local desde BETA-017/BETA-018. Entre
-- las 21:00 y las 24:00 de Argentina la base ya estaba en "mañana": un plan
-- completado a las 22:00 arrancaba al día siguiente (la ficha mostraba
-- "Semana 0"), las alertas adelantaban el mes de tratamiento y un paciente
-- cargado a esa hora quedaba registrado con el día siguiente.
--
-- Esta migración:
--   1. Crea public.hoy(): el día en America/Argentina/Buenos_Aires. Única
--      fuente de "hoy" para fechas de negocio.
--   2. Recrea las 11 funciones que usaban current_date, partiendo de su cuerpo
--      vigente y cambiando SOLO current_date -> public.hoy(). Firma, security,
--      volatilidad, search_path y contratos quedan iguales. `create or replace`
--      conserva los grants/revokes de cada una, así que no se repiten acá.
--      update_etapa_diagnostico no cambia de comportamiento (current_date solo
--      aparecía en un comentario del cuerpo); se recrea para que la base y el
--      schema declarativo queden idénticos.
--   3. Reescribe los comentarios que nombraban current_date.
--
-- SIN migración de datos: las fechas ya guardadas en la franja 21:00–24:00
-- quedan con el día UTC (un día adelantadas). No se corrigen: no hay forma
-- confiable de distinguirlas de las correctas en todas las columnas.
--
-- Escrita a mano: `supabase db diff` no funciona en este repo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. public.hoy()
-- ---------------------------------------------------------------------------

create or replace function public.hoy()
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (now() at time zone 'America/Argentina/Buenos_Aires')::date;
$$;

comment on function public.hoy() is 'Fuente única de "hoy" para las fechas de negocio (ADR 0012): el día en America/Argentina/Buenos_Aires, no el día UTC del servidor. La usan todas las RPC que guardan una fecha de negocio (fecha_alta, fecha_inicio, fecha_finalizacion, fecha_desde/hasta, fecha_seguimiento_esperada) o comparan contra hoy (semana y mes de tratamiento, alertas, evaluación vigente, desbloqueo de contenido). Nunca usar current_date para eso. Los timestamptz siguen en UTC.';

revoke execute on function public.hoy() from public, anon;
grant execute on function public.hoy() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2 y 3. Funciones que usaban current_date + sus comentarios
-- ---------------------------------------------------------------------------

-- get_admin_dashboard_stats

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
    -- "Paciente activo" (CONTEXT.md) = estado `activo` de estados_paciente,
    -- con al menos una asignación vigente (pertenece a la red). Pausados y
    -- dados de baja quedan afuera aunque conserven la asignación; tener o no
    -- un tratamiento en curso no decide (BETA-014).
    select distinct ap.paciente_id
      from public.asignaciones_paciente ap
      join public.pacientes        pa on pa.id = ap.paciente_id
      join public.estados_paciente ep on ep.id = pa.estado_id
     where ap.fecha_hasta is null
       and ep.codigo = 'activo'
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
           -- existe. Sin la rama de etapa_inicio, public.hoy() - NULL es
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
                      (public.hoy() - pm.etapa_inicio) / 28 + 1
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
           and date_trunc('month', fecha_alta) = date_trunc('month', public.hoy())
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

-- derive_alertas_activas

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
               (public.hoy() - er.fecha_inicio) / 28 + 1
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
           and n.fecha_seguimiento_esperada < public.hoy()
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
       and public.hoy() - ea.fecha_inicio < 28

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
     where public.hoy() >= ea.fecha_inicio + ((ea.semanas - 1) * 7)
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
  'Motor compartido del subsistema de alertas: deriva los 6 tipos activos (score_bajo, eval_vencida, mes_3, fin, reinicio, medicion_cierre_pendiente — medir-chakras) restando las atendidas (alertas_atendidas, left join ... where aa.id is null). eval_vencida se decide por fecha_seguimiento_esperada < public.hoy() (no por índice de mes). mes_3/fin/reinicio cuentan el mes de tratamiento en bloques de 28 días desde fecha_inicio, no por calendario (ADR 0011): mes_actual = (public.hoy() - fecha_inicio) / 28 + 1 topado en cantidad_niveles; reinicio dura los primeros 28 días de una etapa no-primera. medicion_cierre_pendiente activa cuando public.hoy() >= fecha_inicio + (semanas_de_etapa - 1) * 7 y NO es descartable (tipos_alerta.descartable = false): se resuelve cerrando la etapa con medición. Las etapas sin arrancar (fecha_inicio is null) no emiten NINGUNA de las 6 (DEC-12 sacó contenido_pendiente, el tipo original que las señalizaba — esa señal vive ahora en el widget "Sin iniciar" del dashboard del terapeuta y en list_terapeutas.sin_iniciar para el admin). Punto único de verdad — lo consumen list_alertas_terapeuta/list_alertas_admin y los counts de get_admin_dashboard_stats/list_terapeutas. Interna: no otorgada a authenticated.';

-- register_paciente

create or replace function public.register_paciente(
  p_nombre            text,
  p_fecha_nacimiento  date,
  p_email             text,
  p_telefono          text,
  p_causa_id          uuid,
  p_algoritmo_id      uuid,
  p_modalidad_id      uuid,
  p_bloqueo_ids       uuid[],
  p_alfabetos         jsonb,
  p_terapeuta_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id         uuid;
  v_estado_pac_activo    uuid;
  v_estado_eta_pendiente uuid;
  v_cantidad_niveles     integer;
  v_paciente_id          uuid;
  v_etapa_id             uuid;
begin
  -- 1. Resolver terapeuta y validar autorización.
  --    Un terapeuta solo puede registrar pacientes para sí mismo.
  --    Un admin puede registrar para cualquier terapeuta.
  v_terapeuta_id := coalesce(p_terapeuta_id, auth.uid());

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

  -- 2. Resolver ids de estado por slug (slugs verificados en seed.sql:181-187).
  select ep.id into v_estado_pac_activo
    from public.estados_paciente as ep
   where ep.codigo = 'activo';

  if not found then
    raise exception 'estado_paciente_activo_no_encontrado'
      using errcode = 'P0002';
  end if;

  -- inicioTratamiento: la etapa nace 'pendiente' (sin arrancar), no 'activa'.
  -- El slug lo garantiza el insert idempotente del schema declarativo
  -- (inicioTratamiento Epic 0, Task 0.1), no el seed.
  select ee.id into v_estado_eta_pendiente
    from public.estados_etapa as ee
   where ee.codigo = 'pendiente';

  if not found then
    raise exception 'estado_etapa_pendiente_no_encontrado'
      using errcode = 'P0002';
  end if;

  -- 3. Resolver cantidad_niveles de la modalidad (pre-chequeo explícito para
  --    un error descriptivo en lugar de una violación de FK genérica).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  -- 4. Inserts en orden dentro de la transacción implícita de la función.

  -- 4a. Paciente base.
  --     Fecha de nacimiento obligatoria (activacionPorTelefono, Epic 2 Task 2.1):
  --     es el segundo factor del canje del OTP en la app móvil (junto al
  --     código); una ficha sin fecha nunca puede activarse.
  if p_fecha_nacimiento is null then
    raise exception 'fecha_nacimiento_requerida' using errcode = '23502';
  end if;

  --     Email es obligatorio (DEC-E3-2): fallar rápido antes de cualquier insert.
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_requerido' using errcode = '23502';
  end if;

  -- Teléfono obligatorio (activacionPorTelefono, DEC-05): una ficha sin
  -- teléfono nunca puede pedir ni recibir el código de activación. Mismo
  -- patrón que email_requerido; la normalización a la forma canónica la hace
  -- el trigger normalizar_telefono_pacientes (21_pacientes.sql), no acá.
  if nullif(btrim(coalesce(p_telefono, '')), '') is null then
    raise exception 'telefono_requerido' using errcode = '23502';
  end if;

  -- baja-voluntaria-cuenta-paciente (Fase 1, ADR-3): si el email pertenece a
  -- un paciente que ya se dio de baja voluntariamente, lanzar un error
  -- legible en vez de dejar que el insert de abajo falle con el 23505 crudo
  -- de pacientes_email_key. Comparación exacta (= btrim(p_email)), NO lower():
  -- debe ser co-extensiva con el índice único, o este guard dispararía para
  -- un email que en los hechos hubiera insertado con éxito. No habilita
  -- re-alta (fuera de alcance) — solo hace legible el fallo.
  if exists (
    select 1
      from public.pacientes as p
      join public.estados_paciente as ep on ep.id = p.estado_id
     where p.email = btrim(p_email)
       and ep.codigo = 'baja_voluntaria'
  ) then
    raise exception 'paciente_dado_de_baja'
      using errcode = 'P0001',
            detail  = 'El email pertenece a un paciente que se dio de baja; la re-alta no está soportada';
  end if;

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, fecha_alta)
  values (
    btrim(p_nombre),
    p_fecha_nacimiento,
    btrim(p_email),
    nullif(btrim(coalesce(p_telefono, '')), ''),
    v_estado_pac_activo,
    public.hoy()
  )
  returning id into v_paciente_id;

  -- 4b. Asignación terapeuta-paciente (fecha_hasta NULL = activa).
  --     asignado_por = auth.uid() siempre: el caller queda auditado,
  --     incluso si es un admin asignando a otro terapeuta.
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por)
  values (v_paciente_id, v_terapeuta_id, public.hoy(), auth.uid());

  -- 4c. Etapa de tratamiento inicial (fecha_finalizacion NULL = en curso).
  --     inicioTratamiento: fecha_inicio NULL + estado 'pendiente' — la etapa
  --     se crea SIN ARRANCAR. Arranca cuando set_entregas_plan completa el
  --     plan de contenido (Task 1.2), no en el alta.
  insert into public.etapas_tratamiento (
    paciente_id,
    terapeuta_id,
    causa_id,
    algoritmo_id,
    modalidad_id,
    fecha_inicio,
    estado_id
  )
  values (
    v_paciente_id,
    v_terapeuta_id,
    p_causa_id,
    p_algoritmo_id,
    p_modalidad_id,
    null,
    v_estado_eta_pendiente
  )
  returning id into v_etapa_id;

  -- 4d. Bloqueos de la etapa (bulk via unnest; array vacío genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 4e. Alfabetos de la etapa (bulk via jsonb_array_elements; jsonb vacío ('[]')
  --     genera 0 filas, igual que el unnest de array vacío anterior).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         nullif(item ->> 'numero', '')::int
    from jsonb_array_elements(p_alfabetos) as item;

  -- 4f. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     inicioTratamiento: la grilla de N niveles se crea igual (invariante
  --     "toda etapa tiene su grilla"), pero SIN fecha_seguimiento_esperada —
  --     la etapa todavía no arrancó, no hay fecha_inicio contra la cual
  --     anclar la agenda. Se agenda cuando la etapa arranque (Task 1.2).
  insert into public.niveles (etapa_id, numero_nivel)
  select v_etapa_id, g.n
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- 5. Devolver el id del paciente creado.
  return v_paciente_id;
end;
$$;

comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. Devuelve el uuid del paciente creado. Lanza fecha_nacimiento_requerida (23502) si p_fecha_nacimiento es null — es el segundo factor del canje de OTP (activacionPorTelefono, Epic 2 Task 2.1); una ficha sin fecha nunca puede activarse. Lanza email_requerido (23502) si p_email queda vacío tras el trim y telefono_requerido (23502) si p_telefono queda vacío tras el trim (activacionPorTelefono, DEC-05) — la normalización a la forma canónica corre después, en el trigger normalizar_telefono_pacientes. Lanza paciente_dado_de_baja (P0001) si p_email pertenece a un paciente en estado baja_voluntaria (baja-voluntaria-cuenta-paciente, Fase 1, ADR-3); una colisión de email con un paciente activo/pausado sigue devolviendo el 23505 crudo de pacientes_email_key.';

-- update_etapa_diagnostico

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
  --    Fechas ancladas a v_fecha_inicio (fecha real de la etapa), NO a public.hoy(),
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

-- set_entregas_plan

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
       set fecha_inicio = public.hoy(),
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
         set fecha_seguimiento_esperada = public.hoy() + 28 * n.numero_nivel
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
  'Full-replace del plan de entregas de una etapa: valida primero el mapa tipo-por-orden (DEC-8: 1=video, 2=audio, 3=egregor, 4=cma, 5=ic — debe espejar SLOT_DEFINITIONS en slotDefinitions.ts; lanza tipo_slot_invalido, 23514, si no matchea, y no toca el plan guardado), luego borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 5 slots persistibles — via etapa_plan_completo; la frase dejó de ser una entrega asignable en frasesAutomaticas, se deriva de causa+algoritmo+semana), arranca el tratamiento de forma idempotente e irreversible (fecha_inicio = public.hoy(), estado ''activa'', solo si fecha_inicio y fecha_finalizacion eran NULL — DEC-E1-2 evita resucitar una etapa cerrada) y, si arrancó recién, recomputa fecha_seguimiento_esperada de los niveles anclada al arranque real (DEC-4): public.hoy() + 28 * numero_nivel (un mes de tratamiento son 28 días, ADR 0011). Siempre que el plan está completo devuelve el paciente_id, arrancado o no, para que el web console dispare la invitación (EF paciente-invitacion), que entrega la bienvenida post-activación (activacionPorTelefono Epic 3; el OTP lo pide el paciente desde la app) — el reintento depende de este return no acoplarse al arranque (DEC-E1-1); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

-- cerrar_etapa

create or replace function public.cerrar_etapa(
  p_paciente_id uuid,
  p_estado      text,
  p_motivo      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id     uuid;
  v_fecha_inicio date;
  v_estado_id    uuid;
begin
  -- 1. Resolver la etapa activa (fecha_finalizacion IS NULL = en curso).
  -- order by + limit 1 para ser determinístico: si por una anomalía de datos
  -- hubiera más de una etapa sin fecha_finalizacion, tomamos la más reciente
  -- en lugar de una fila arbitraria (no hay índice único que lo garantice).
  -- coalesce(fecha_inicio, created_at) desc, no fecha_inicio desc a secas:
  -- en Postgres `desc` es NULLS FIRST, y una etapa sin arrancar (fecha_inicio
  -- null) no debe flotar al tope solo por eso.
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
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

  -- 2. Autorizar: la asignación activa es la identidad de escritura (DEC-31,
  --    medir-chakras) — etapas_tratamiento.terapeuta_id demota a procedencia
  --    ("quién abrió la etapa"), nunca autorización. is_admin() se preserva
  --    acá: este es el cierre ADMINISTRATIVO (design §1.0/§9.3), a
  --    diferencia de registrar_medicion/cerrar_etapa_con_medicion, que NO
  --    llevan este disjunto (un admin sin asignación puede cerrar pero
  --    nunca medir). has_active_assignment() devuelve exists(...), nunca
  --    NULL — se retira la comparación NULL-safe que hacía falta contra
  --    terapeuta_id.
  if not (public.is_admin() or public.has_active_assignment(p_paciente_id)) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Validar el estado terminal solicitado.
  if p_estado not in ('finalizada', 'abandonada') then
    raise exception 'estado_invalido'
      using errcode = 'P0001',
            detail  = 'p_estado debe ser ''finalizada'' o ''abandonada''';
  end if;

  select ee.id into v_estado_id
    from public.estados_etapa as ee
   where ee.codigo = p_estado;

  if not found then
    raise exception 'estado_etapa_no_encontrado'
      using errcode = 'P0002',
            detail  = 'p_estado no coincide con ningún código de estados_etapa';
  end if;

  -- 3.5. DEC-33 (medir-chakras): la medición de cierre es obligatoria SOLO
  --      cuando p_estado es 'finalizada' Y la etapa arrancó Y quien cierra
  --      tiene asignación activa. Condicional a propósito, no incondicional:
  --      el cierre administrativo sin asignación (admin) y el cierre de una
  --      etapa que nunca arrancó (fuera de alcance, DevSpec §17) siguen sin
  --      exigir medición — un guard incondicional forzaría al admin a cerrar
  --      un tratamiento completo como 'abandonada', corrompiendo ese estado.
  if p_estado = 'finalizada'
     and v_fecha_inicio is not null
     and public.has_active_assignment(p_paciente_id) then
    raise exception 'medicion_cierre_requerida'
      using errcode = 'P0001',
            detail  = 'usar cerrar_etapa_con_medicion';
  end if;

  -- 3.6. Cierre automático de la lectura de estructura (medir-chakras design
  --      §1.4/§3.1), ANTES del update de más abajo: si algo falla acá, la
  --      etapa queda abierta, nunca cerrada sin su copia. No-op si la etapa
  --      no arrancó o no tiene mediciones previas.
  perform public._generar_cierre_automatico(v_etapa_id);

  -- 4. Cerrar la etapa. motivo_cierre es opcional (DEC-11): vacío/whitespace
  --    colapsa a NULL, nunca a un texto default (sería falso si p_estado es
  --    'abandonada'). fecha_finalizacion = public.hoy(), server-side.
  update public.etapas_tratamiento
     set fecha_finalizacion = public.hoy(),
         estado_id          = v_estado_id,
         motivo_cierre      = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v_etapa_id;
end;
$$;

comment on function public.cerrar_etapa(uuid, text, text) is
  'Cierra la etapa activa de un paciente con un estado terminal (finalizada|abandonada): fecha_finalizacion = public.hoy(), estado_id resuelto por slug, motivo_cierre opcional (vacío/whitespace -> NULL). Acceso: is_admin() or has_active_assignment(p_paciente_id) — DEC-31 (medir-chakras): terapeuta_id de la etapa ya NO autoriza, solo procedencia. DEC-33: exige cerrar_etapa_con_medicion (medicion_cierre_requerida, P0001) cuando p_estado=finalizada, la etapa arrancó y el caller tiene asignación activa; el cierre administrativo sin asignación y el de una etapa sin arrancar no exigen medición. Genera cierre_automatico (_generar_cierre_automatico) antes de cerrar, cuando corresponde.';

-- get_mi_tratamiento_activo

create or replace function public.get_mi_tratamiento_activo()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id       uuid;
  v_etapa_id          uuid;
  v_fecha_inicio      date;
  v_cantidad_niveles  int;
  v_cantidad_sesiones int;
  v_nivel_actual      int;
  v_max_esperada      date;
  v_semanas_totales   int;
  v_semana_actual     int;
  v_proxima           date;
  v_estado            text;
  v_result            jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa + modalidad (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id, et.fecha_inicio, m.cantidad_niveles, m.cantidad_sesiones
    into v_etapa_id, v_fecha_inicio, v_cantidad_niveles, v_cantidad_sesiones
    from public.etapas_tratamiento as et
    join public.modalidades as m on m.id = et.modalidad_id
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. nivelActual (espeja mapper L89-97): primer nivel sin cerrar (asc), o el
  --    último si todos cerrados. Single-pass con coalesce + aggregate filter.
  --    Sin niveles → coalesce(null, null) = null.
  select coalesce(
    min(n.numero_nivel) filter (where n.fecha_seguimiento_real is null),
    max(n.numero_nivel)
  )
    into v_nivel_actual
    from public.niveles as n
   where n.etapa_id = v_etapa_id;

  -- 4. v_max_esperada: insumo de semanasTotales (espeja lastFechaSeguimientoEsperada L101-106).
  --    max() ignora nulls de forma nativa.
  select max(n.fecha_seguimiento_esperada)
    into v_max_esperada
    from public.niveles as n
   where n.etapa_id = v_etapa_id;

  -- 5. semanasTotales (espeja mapper L117-132, cuidado PAC-005).
  --    Rama agendada: ceil((max_esperada - fecha_inicio) / 7) con greatest(1, ...).
  --    Fallback: coalesce(cantidad_sesiones, cantidad_niveles*4).
  --    NUNCA *4 a secas (eso es el bug PAC-005: daba 16 para toda modalidad con 4 niveles).
  v_semanas_totales := case
    when v_max_esperada is not null
      then greatest(1, ceil((v_max_esperada - v_fecha_inicio)::numeric / 7))::int
    else coalesce(v_cantidad_sesiones, v_cantidad_niveles * 4)
  end;

  -- 6. semanaActual (espeja mapper L134-145): floor((hoy - inicio)/7) + 1,
  --    capeada arriba a semanasTotales. SIN clamp inferior (el mapper no tiene piso).
  v_semana_actual := least(
    floor((public.hoy() - v_fecha_inicio)::numeric / 7)::int + 1,
    v_semanas_totales
  );

  -- 7. proximaEvaluacion (espeja mapper L181-188): min fecha futura, comparación
  --    estricta (> public.hoy() excluye hoy, espejando getTime() > today.getTime()).
  --    Null si no queda ninguna fecha futura.
  select min(n.fecha_seguimiento_esperada)
    into v_proxima
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada > public.hoy();

  -- 8. estado: código del estado del paciente (no de la etapa).
  --    Misma fuente que get_mi_perfil; null si paciente no tiene estado asignado.
  select ep.codigo
    into v_estado
    from public.pacientes as p
    left join public.estados_paciente as ep on ep.id = p.estado_id
   where p.id = v_paciente_id;

  -- 9. Armar y devolver el jsonb con las 7 claves del contrato (D-3).
  --    NO se incluyen etapaActual/etapasTotales.
  v_result := jsonb_build_object(
    'nivelActual',       v_nivel_actual,
    'nivelesTotales',    v_cantidad_niveles,
    'semanaActual',      v_semana_actual,
    'semanasTotales',    v_semanas_totales,
    'fechaInicio',       v_fecha_inicio,
    'proximaEvaluacion', v_proxima,
    'estado',            v_estado
  );
  return v_result;
end;
$$;

comment on function public.get_mi_tratamiento_activo() is
  'Devuelve el resumen de progreso del tratamiento activo del paciente caller. '
  'Espeja mapAsignacionToPaciente.ts: nivelActual (primer nivel sin cerrar asc, o el último si todos completos), '
  'semanasTotales (cascada: ceil((maxEsperada-inicio)/7) → cantidad_sesiones → cantidad_niveles*4), '
  'semanaActual (floor((hoy-inicio)/7)+1 capeada a semanasTotales, sin piso), '
  'proximaEvaluacion (min fecha_seguimiento_esperada > public.hoy(), comparación estricta). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó '
  '(fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo. '
  'NO devuelve etapaActual/etapasTotales.';

-- get_mi_plan_semanal

create or replace function public.get_mi_plan_semanal()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
  v_fecha_inicio date;
  v_result      jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa (gate sin_etapa_activa).
  --    No se necesita la modalidad: las semanas salen de las entregas_plan realmente
  --    cargadas (el plan se autoriza completo antes de generar el OTP).
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Armar el array de semanas en un único query con CTEs (DEC-3-1…DEC-3-4).
  --    Una fila de salida por SEMANA (no por entrega): fechaDesbloqueo es el
  --    inicio de la semana (fecha_inicio + (semana-1)*7), robusto a entregas en
  --    días distintos dentro de la misma semana (evita semanas duplicadas).
  with base as (
    -- Una fila por entrega_plan: deriva semana y los campos de contenido.
    -- La frase ya NO sale de acá (Task 2.2): frase_id/frases_motivacionales
    -- fueron retirados de esta CTE; la lista de semanas sigue viniendo de
    -- entregas_plan (DEC-2-1), pero su contenido de frases se resuelve más
    -- abajo con la CTE frases_por_semana.
    select
      floor(ep.dia_offset / 7)::int + 1 as semana,
      ep.orden,
      ep.dia_offset,
      ep.contenido_id,
      c.id           as pieza_id,
      c.tipo         as pieza_tipo,
      c.titulo       as pieza_titulo,
      c.descripcion  as pieza_descripcion,
      c.recurso_ref  as pieza_recurso_ref,
      c.duracion_seg as pieza_duracion
    from public.entregas_plan as ep
    left join public.contenidos as c on c.id = ep.contenido_id
    where ep.etapa_id = v_etapa_id
  ),
  semanas as (
    -- Una fila por semana distinta; fecha_desbloqueo = inicio de la semana.
    select
      b.semana,
      (v_fecha_inicio + (b.semana - 1) * 7)::date as fecha_desbloqueo
    from base as b
    group by b.semana
  ),
  marcadas as (
    -- estadoSemana por semana. Ventana semiabierta [desbloqueo, desbloqueo+7).
    select
      s.semana,
      s.fecha_desbloqueo,
      case
        when public.hoy() <  s.fecha_desbloqueo     then 'futura'
        when public.hoy() >= s.fecha_desbloqueo + 7 then 'anterior'
        else 'actual'
      end as estado_semana
    from semanas as s
  ),
  frases_por_semana as (
    -- Frases derivadas de la etapa (Task 0.3, epic-0): 3 objetos por semana
    -- ya ordenados por orden. Joineada por semana contra `marcadas`, nunca
    -- agrega semanas nuevas (frases_de_etapa puede cubrir más semanas que
    -- las que tienen media cargada; el join en el select final filtra eso).
    select
      f.semana,
      jsonb_agg(
        jsonb_build_object(
          'orden',  f.orden,
          'origen', f.origen,
          'texto',  f.texto
        )
        order by f.orden
      ) as frases
    from public.frases_de_etapa(v_etapa_id) as f
    group by f.semana
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana',          m.semana,
      'estadoSemana',    m.estado_semana,
      'fechaDesbloqueo', m.fecha_desbloqueo,
      -- piezas: filas de media (contenido_id not null) de la semana, ordenadas
      -- por (orden, dia_offset). recursoRef E imagenes nuleados server-side
      -- para futuras, en el MISMO case cada uno (design §6 ADR-5): ambos
      -- keys leen el mismo m.estado_semana en el mismo scope, y el case de
      -- imagenes corta en corto en 'futura' — el subquery a
      -- contenido_imagenes directamente NO SE EVALÚA para una semana futura,
      -- los paths no solo se descartan, nunca se leen. No repetir el error de
      -- separar esta regla en un case/CTE distinto (así casi se pierde
      -- `frases`, ver DEC-9). Semana sin media devuelve piezas: [] (coalesce).
      'piezas', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',          b.pieza_id,
            'tipo',        b.pieza_tipo,
            'titulo',      b.pieza_titulo,
            'descripcion', b.pieza_descripcion,
            'recursoRef',  case when m.estado_semana = 'futura' then null else b.pieza_recurso_ref end,
            'imagenes',    case
                              when m.estado_semana = 'futura' then '[]'::jsonb
                              else coalesce((
                                select jsonb_agg(
                                         jsonb_build_object('path', ci.path, 'orden', ci.orden)
                                         order by ci.orden)
                                  from public.contenido_imagenes as ci
                                 where ci.contenido_id = b.pieza_id
                              ), '[]'::jsonb)
                            end,
            'duracion',    b.pieza_duracion
          )
          order by b.orden, b.dia_offset
        )
        from base as b
        where b.semana = m.semana
          and b.contenido_id is not null
      ), '[]'::jsonb),
      -- frases: los 3 objetos { orden, origen, texto } derivados de
      -- frases_de_etapa para esta semana, ya ordenados por orden. Nuleada
      -- (vaciada) server-side para semanas futuras (DEC-2-2, misma regla que
      -- ya se aplica a recursoRef). Sin fila en frases_por_semana (run-out
      -- del catálogo) → [] via coalesce, nunca null.
      'frases', case
        when m.estado_semana = 'futura' then '[]'::jsonb
        else coalesce(fps.frases, '[]'::jsonb)
      end
    )
    order by m.semana
  ), '[]'::jsonb)
  into v_result
  from marcadas as m
  left join frases_por_semana as fps on fps.semana = m.semana;

  return v_result;
end;
$$;

comment on function public.get_mi_plan_semanal() is
  'Devuelve el plan de tratamiento semanal del paciente caller como array jsonb. '
  'Cada elemento: { semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo, descripcion, recursoRef, imagenes: [{path, orden}], duracion }], frases: [{ orden, origen, texto }] }. '
  'semana = floor(dia_offset/7)+1; fechaDesbloqueo = fecha_inicio + dia_offset. '
  'estadoSemana: futura (hoy < desbloqueo), actual ([desbloqueo, desbloqueo+7)), anterior (hoy >= desbloqueo+7). '
  'La lista de semanas sigue viniendo de entregas_plan (una semana existe si tiene media cargada); '
  'frases se deriva invocando public.frases_de_etapa(v_etapa_id) (Task 0.3) y se joinea por semana, '
  'nunca agrega semanas nuevas. frases trae hasta 3 objetos ordenados por orden; [] si la semana no tiene '
  'frases derivadas (run-out del catálogo) o si es futura (DEC-2-2, misma nulling que recursoRef). '
  'imagenes trae el array ordenado {path, orden} de contenido_imagenes para piezas tipo galería (cma/ic); '
  '[] para toda pieza no-galería (no hay filas). '
  'El campo escalar frase (deprecado) NO existe en este contrato: no se lee entregas_plan.frase_id ni frases_motivacionales. '
  'Nulling de futuras: recursoRef por pieza = null e imagenes = [] (subquery nunca evaluado) y frases = [] cuando estadoSemana = futura — NO NEGOCIABLE, evita filtrar paths de bucket de semanas no desbloqueadas. '
  'recursoRef e imagenes[].path son paths del bucket, NO URLs firmadas — el mobile firma client-side. '
  'Etapa sin entregas → []. Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe '
  'pero no arrancó (fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';

-- get_mi_evaluacion_vigente

create or replace function public.get_mi_evaluacion_vigente()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id     uuid;
  v_etapa_id        uuid;
  v_causa_id        uuid;
  v_algoritmo_id    uuid;
  v_nivel_id        uuid;
  v_numero_nivel    int;
  v_causa_frase     text;
  v_algoritmo_frase text;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa + causa_id/algoritmo_id (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id, et.causa_id, et.algoritmo_id
    into v_etapa_id, v_causa_id, v_algoritmo_id
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
     and et.fecha_inicio is not null      -- ← una etapa sin arrancar NO es un tratamiento activo
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Determinar el nivel vigente: menor numero_nivel vencido sin responder.
  --    <= public.hoy() excluye nulls legacy (la comparación con null es false).
  --    not exists sobre nivel_evaluacion garantiza que el nivel no fue respondido.
  --    order by numero_nivel asc limit 1: si hay varios vencidos, el menor primero.
  select n.id, n.numero_nivel
    into v_nivel_id, v_numero_nivel
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada <= public.hoy()
     and not exists (
       select 1 from public.nivel_evaluacion as ne where ne.nivel_id = n.id
     )
   order by n.numero_nivel asc
   limit 1;

  if not found then
    return jsonb_build_object('vigente', false);
  end if;

  -- 4. Armar resultadoEsperado con mapeo 1:1 numero_etapa = numero_nivel.
  --    Si falta la fila de catálogo, la frase queda null (sin raise) — una
  --    fila faltante no debe tirar la pantalla de evaluación.
  select ce.frase_esperada
    into v_causa_frase
    from public.causa_etapas as ce
   where ce.causa_id = v_causa_id
     and ce.numero_etapa = v_numero_nivel;

  select ae.frase_esperada
    into v_algoritmo_frase
    from public.algoritmo_etapas as ae
   where ae.algoritmo_id = v_algoritmo_id
     and ae.numero_etapa = v_numero_nivel;

  return jsonb_build_object(
    'vigente',           true,
    'nivelId',           v_nivel_id,
    'resultadoEsperado', jsonb_build_object(
      'causa',     v_causa_frase,
      'algoritmo', v_algoritmo_frase
    )
  );
end;
$$;

comment on function public.get_mi_evaluacion_vigente() is
  'Determina el nivel vigente del paciente caller: el menor numero_nivel con '
  'fecha_seguimiento_esperada <= public.hoy() y sin fila en nivel_evaluacion. '
  'Para ese nivel, arma las 2 frases esperadas con mapeo 1:1 numero_etapa = numero_nivel '
  'desde causa_etapas (causa_id de la etapa) y algoritmo_etapas (algoritmo_id de la etapa). '
  'Devuelve { vigente: false } si no hay nivel pendiente; '
  '{ vigente: true, nivelId, resultadoEsperado: { causa, algoritmo } } si hay uno. '
  'Frases null si falta la fila de catálogo (no interrumpe la pantalla de evaluación). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa o si la única etapa existe pero no arrancó '
  '(fecha_inicio null — Task 5.1); no_vinculado (P0001) si no hay vínculo.';

-- baja_voluntaria_paciente

create or replace function public.baja_voluntaria_paciente(p_user_id uuid)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_estado_baja        uuid;
  v_estado_abandonada  uuid;
  v_paciente_id        uuid;
  v_etapa_id           uuid;
begin
  -- 0. Fail closed. Sin esto un p_user_id null atraviesa todos los lookups
  --    (user_id = null nunca matchea) y cae en la rama idempotente, devolviendo
  --    'ya_dado_de_baja' a un llamador sin identidad.
  if p_user_id is null then
    raise exception 'no_autorizado'
      using errcode = '42501',
            detail  = 'p_user_id es obligatorio';
  end if;

  -- 1. Resolver el catálogo ANTES de mutar nada (mismo patrón que
  --    register_paciente): si falta una fila de catálogo, abortamos limpio en
  --    vez de dejar la baja a mitad de camino.
  select id into v_estado_baja
    from public.estados_paciente
   where codigo = 'baja_voluntaria';

  if v_estado_baja is null then
    raise exception 'estado_baja_voluntaria_no_encontrado'
      using errcode = 'P0002',
            detail  = 'Falta la fila baja_voluntaria en estados_paciente';
  end if;

  select id into v_estado_abandonada
    from public.estados_etapa
   where codigo = 'abandonada';

  if v_estado_abandonada is null then
    raise exception 'estado_etapa_abandonada_no_encontrado'
      using errcode = 'P0002',
            detail  = 'Falta la fila abandonada en estados_etapa';
  end if;

  -- 2. Resolver el paciente DENTRO de la transacción, a partir del user_id
  --    verificado. Resolverlo acá (y no recibir un p_paciente_id del llamador)
  --    es lo que cierra la ventana TOCTOU y la superficie de IDOR.
  --    for update serializa un doble tap concurrente: el segundo llamador
  --    bloquea, y cuando entra ya ve user_id null y toma la rama idempotente.
  select id into v_paciente_id
    from public.pacientes
   where user_id = p_user_id
     for update;

  -- 3. Sin paciente vinculado. Antes de asumir "ya dado de baja", descartar que
  --    el llamador sea un terapeuta o un admin: borrarles la cuenta de auth
  --    cascadearía profiles -> terapeutas y destruiría historial de asignaciones.
  --    La baja de terapeutas está explícitamente fuera de alcance. Esto es una
  --    guarda de autorización, no una comodidad: no dejamos que falle sola la FK
  --    de asignaciones_paciente.terapeuta_id, porque apoyarse en un constraint
  --    no es un control de acceso.
  if v_paciente_id is null then
    if public.is_admin(p_user_id)
       or exists (select 1 from public.terapeutas where id = p_user_id) then
      raise exception 'no_autorizado'
        using errcode = '42501',
              detail  = 'La baja voluntaria es solo para cuentas de paciente';
    end if;

    -- Paciente ya desvinculado (reentrada tras un deleteUser fallido), o una
    -- cuenta de auth que no es ni paciente ni terapeuta ni admin. En ambos casos
    -- la Edge Function sigue adelante y borra la cuenta del propio llamador.
    return jsonb_build_object('status', 'ya_dado_de_baja', 'pacienteId', null);
  end if;

  -- 4. Marcar la ficha como baja voluntaria y soltar el vínculo con auth.users.
  --    Nulear user_id es lo que habilita el delete de la cuenta (paso 0 del
  --    contrato) y, de yapa, cierra las cinco RPCs de paciente: todas resuelven
  --    identidad por get_mi_paciente_id(), que ahora levanta no_vinculado.
  update public.pacientes
     set estado_id            = v_estado_baja,
         activo               = false,
         fecha_cambio_estado  = now(),
         motivo_cambio_estado = 'Baja voluntaria solicitada por el paciente desde la app',
         user_id              = null
   where id = v_paciente_id;

  -- 5. Cerrar la asignación activa. Esto es lo que saca al paciente de las
  --    listas, dashboards y alertas del terapeuta: todos los consumidores
  --    filtran por fecha_hasta is null, ninguno deriva "activo" del catálogo
  --    de estados. Sin este paso el paciente queda de fantasma en la consola.
  update public.asignaciones_paciente
     set fecha_hasta = public.hoy(),
         motivo      = 'Cierre por baja voluntaria del paciente'
   where paciente_id = v_paciente_id
     and fecha_hasta is null;

  -- 5.5. Cierre automático de la lectura de estructura (medir-chakras design
  --      §3.2), ANTES de cerrar la(s) etapa(s) en el paso 6. El update de
  --      abajo NO tiene limit 1 y puede tocar más de una etapa abierta si hay
  --      una anomalía de datos; este for recorre exactamente el mismo
  --      conjunto para que ninguna quede cerrada sin su copia. Trap B: la
  --      asignación YA se cerró en el paso 5, y esta función corre bajo
  --      service_role (auth.uid() es null) — por eso _generar_cierre_automatico
  --      no toma NINGUNA decisión de autorización, no podría. La función
  --      devuelve null (no-op) para etapas sin mediciones o sin arrancar.
  for v_etapa_id in
    select et.id
      from public.etapas_tratamiento et
     where et.paciente_id = v_paciente_id
       and et.fecha_finalizacion is null
  loop
    perform public._generar_cierre_automatico(v_etapa_id);
  end loop;

  -- 6. Cerrar la etapa de tratamiento activa, si la hay. Un paciente sin etapa
  --    activa es un caso válido (no-op), no un error.
  update public.etapas_tratamiento
     set estado_id          = v_estado_abandonada,
         fecha_finalizacion = public.hoy(),
         motivo_cierre      = 'Cierre por baja voluntaria del paciente'
   where paciente_id = v_paciente_id
     and fecha_finalizacion is null;

  -- 7. Supersede el OTP de activación vigente. Con user_id ya en null,
  --    validar_otp_para_creacion devolvería 'ok' para un OTP active y dejaría
  --    crear una cuenta nueva sobre la ficha conservada. Este es el primer
  --    anillo de defensa; el segundo son las guardas de emisión en
  --    generar_otp_activacion / regenerar_otp_activacion.
  update public.otps_activacion
     set estado = 'superseded'
   where paciente_id = v_paciente_id
     and estado      = 'active';

  -- 8. Rastro de auditoría. usuario_id tiene que ser null: audit_log.usuario_id
  --    referencia profiles(id) con NO ACTION, y esa fila está por desaparecer
  --    en el cascade de auth.users. Guardamos el user_id previo en
  --    datos_anteriores para no perder quién pidió la baja — sin eso la fila de
  --    auditoría registra que "algo pasó" pero no quién, y no cumple su función.
  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores)
  values (
    'pacientes',
    v_paciente_id::text,
    'baja_voluntaria',
    null,
    jsonb_build_object('user_id', p_user_id)
  );

  return jsonb_build_object('status', 'ok', 'pacienteId', v_paciente_id);
end;
$$;

comment on function public.baja_voluntaria_paciente(uuid) is
  'Baja voluntaria de la cuenta de un paciente: desvincula user_id, marca la ficha como baja_voluntaria, genera cierre_automatico de estructura (medir-chakras) para cada etapa abierta con mediciones previas, cierra asignación y etapa(s) activas, supersede el OTP vigente y audita. Devuelve jsonb {status: ok|ya_dado_de_baja, pacienteId}. Idempotente a propósito: la reentrada es el camino de recuperación si auth.admin.deleteUser falla. NO borra auth.users — eso lo hace la Edge Function paciente-cuenta inmediatamente después. Levanta no_autorizado (42501) si p_user_id es null o pertenece a un terapeuta/admin. Acceso: service_role.';

-- cerrar_etapa_con_medicion

create or replace function public.cerrar_etapa_con_medicion(
  p_paciente_id        uuid,
  p_motivo             text,
  p_valores            jsonb,
  p_medicion_previa_id uuid
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_etapa_id     uuid;
  v_fecha_inicio date;
  v_ultima_id    uuid;
  v_estado_id    uuid;
  v_cierre_id    uuid;
begin
  -- 1. Resolver + lockear la etapa activa. Query idéntica a cerrar_etapa.
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1
     for update;

  if not found then
    raise exception 'etapa_activa_no_encontrada' using errcode = 'P0002';
  end if;

  -- 2. Autorización: SOLO asignación activa. Sin disjunto de admin.
  if not public.has_active_assignment(p_paciente_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. La etapa debe haber arrancado.
  if v_fecha_inicio is null then
    raise exception 'etapa_no_iniciada' using errcode = 'P0001';
  end if;

  -- 4. Concurrencia optimista, idéntico criterio que registrar_medicion.
  select m.id into v_ultima_id
    from public.mediciones_estructura m
   where m.etapa_id = v_etapa_id
   order by m.registrada_en desc, m.id desc
   limit 1;

  if v_ultima_id is distinct from p_medicion_previa_id then
    -- PT409, nunca 40001: PostgREST reintenta serialization_failure en loop
    -- y el cliente recibe un 504 a los ~60s (MED-007). PT409 -> HTTP 409.
    raise exception 'conflicto_medicion' using errcode = 'PT409';
  end if;

  -- 5. Validar valores contra el catálogo activo.
  perform public._validar_valores_medicion(
    p_valores,
    array(select id from public.centros_energeticos where activo order by orden)
  );

  -- 6. Insertar la medición de cierre.
  v_cierre_id := public._insertar_medicion(v_etapa_id, 'cierre', p_valores);

  -- 7. Cerrar la etapa. Misma colapsada de motivo_cierre que cerrar_etapa
  --    (71_rpcs_pacientes.sql:769). Insert-then-close: si algo falla acá
  --    (no debería, ya validamos todo), la etapa queda abierta, no cerrada
  --    sin su lectura.
  select ee.id into v_estado_id from public.estados_etapa ee where ee.codigo = 'finalizada';

  update public.etapas_tratamiento
     set fecha_finalizacion = public.hoy(),
         estado_id          = v_estado_id,
         motivo_cierre      = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v_etapa_id;

  return v_cierre_id;
end;
$$;

comment on function public.cerrar_etapa_con_medicion(uuid, text, jsonb, uuid) is
  'Cierre transaccional: inserta la medición de cierre y cierra la etapa como finalizada en una transacción. Autoriza SOLO con has_active_assignment(paciente) — sin disjunto de admin (design §1.0/DEC-31): el cierre administrativo sin asignación es cerrar_etapa, no esta RPC. Resuelve la etapa activa con la misma query que cerrar_etapa. Errores: etapa_activa_no_encontrada (P0002), no_autorizado (42501), etapa_no_iniciada (P0001), conflicto_medicion (PT409), valores_invalidos (22023).';
