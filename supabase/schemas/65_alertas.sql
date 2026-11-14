-- ---------------------------------------------------------------------------
-- derive_alertas_activas
-- ---------------------------------------------------------------------------
-- Motor compartido del subsistema de alertas: produce TODAS las alertas
-- activas de la red (los 5 tipos), menos las atendidas. Es el punto
-- único de verdad — lo consumen list_alertas_terapeuta / list_alertas_admin
-- (Epic 1 y 2) y el rewire de los counts (get_admin_dashboard_stats.
-- alertas_activas, list_terapeutas.alertas_activas). Reusa el andamiaje de
-- get_admin_dashboard_stats (62_rpc_admin.sql): activos, etapas_ranked,
-- mes_actual en bloques de 28 días desde fecha_inicio (un mes de tratamiento
-- son 4 semanas, NO un mes calendario — ADR 0011), topado en cantidad_niveles
-- de la modalidad.
--
-- DEC-12 (feat/inicio-tratamiento, post-implementación): el 6to tipo
-- (contenido_pendiente) se sacó del motor — es redundante con el widget
-- "Sin iniciar" del dashboard del terapeuta (ya lo muestra ahí). El admin no
-- pierde visibilidad: en su lugar, list_terapeutas.sin_iniciar
-- (70_rpcs_terapeutas.sql) le da el count por terapeuta. Con la baja del tipo,
-- etapa_sin_iniciar deja de tener consumidor y se elimina la CTE.
--
-- etapa_activa (SOLO las arrancadas, fecha_inicio is not null → alimenta
-- eval_vencida/mes_3/fin/reinicio). El filtro fecha_inicio is not null vive
-- en la CTE, ANTES del cálculo de mes_actual: greatest(1, NULL) devuelve 1
-- (no NULL, las funciones variádicas ignoran nulls), así que si una etapa sin
-- arrancar llegara a ese cálculo saldría con mes_actual = 1 y dispararía
-- eval_vencida sobre su nivel 1 — el bug original resucitado. Filtrar antes
-- hace que sea estructuralmente imposible. Este filtro se preserva intacto
-- pese a la baja de DEC-12: es lo que apaga eval_vencida/mes_3/fin/reinicio
-- para una etapa sin arrancar, y nada de esta baja lo toca.
--
-- Los 5 tipos:
--   score_bajo          — última nivel_evaluacion del paciente (cross-etapa,
--                          max fecha_respuesta) con score <= 3. evento_ref =
--                          nivel_evaluacion.id.
--   eval_vencida         — nivel más viejo sin nivel_evaluacion de la etapa
--                          activa cuya fecha_seguimiento_esperada ya pasó
--                          (< public.hoy(), el más antiguo cuando hay varios
--                          vencidos). Decidido por FECHA, no por índice de
--                          mes (D-1): comparar numero_nivel <= mes_actual
--                          contaba el mes en curso como ya vencido. Los
--                          niveles con fecha_seguimiento_esperada = NULL (de
--                          una etapa sin arrancar) nunca matchean el `<`.
--                          evento_ref = nivel.id.
--   mes_3                — etapa activa con mes_actual = 3 (días 56 a 83
--                          desde fecha_inicio).
--                          evento_ref = etapa_id || ':mes_3'.
--   fin                  — etapa activa con mes_actual = cantidad_niveles,
--                          el último mes. evento_ref = etapa_id || ':fin'.
--   reinicio             — etapa activa no-primera (etapa_ordinal >= 2) en
--                          su primer mes de tratamiento: menos de 28 días
--                          desde fecha_inicio (DEC-31, feat/nuevo-tratamiento;
--                          ADR 0011). evento_ref = etapa_id || ':reinicio'.
--                          Deja de derivarse sola el día 28.
--   medicion_cierre_pendiente — etapa activa dentro de su última semana de
--                          contenido (medir-chakras, DEC-32/DEC-33), sin
--                          medición de cierre todavía. evento_ref = etapa_id
--                          || ':medicion_cierre'. NO descartable
--                          (tipos_alerta.descartable = false): se resuelve
--                          cerrando la etapa con medición, no marcándola
--                          atendida. Se apaga sola al cerrar la etapa.
--
-- Excluye las que tienen dismissal en alertas_atendidas (left join ... where
-- aa.id is null: activa = derivada − atendida). Función interna compartida:
-- no se otorga a `authenticated`; las lecturas públicas pasan por las RPCs
-- scoped list_alertas_terapeuta / list_alertas_admin (Epic 1/2, no en este
-- archivo).
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

-- Postgres otorga EXECUTE por default en dos niveles: el grant PUBLIC
-- implícito Y, en este proyecto, un "alter default privileges" que además
-- otorga execute a `authenticated` en toda función nueva del schema public
-- (confirmado via pg_default_acl). Sin revocar AMBOS, un terapeuta podría
-- invocar el motor directamente y, al ser security definer, ver TODA la red
-- (bypassea RLS). Las RPCs scoped (list_alertas_terapeuta / list_alertas_admin,
-- tasks 1.1/2.1) siguen pudiendo llamarla porque corren como security
-- definer también (privilegio de owner, no de rol invocador). Si esta función
-- se recrea con `create or replace`, el grant global se re-agrega — hay que
-- volver a correr estos dos revokes.
revoke execute on function public.derive_alertas_activas() from public, anon, authenticated;
