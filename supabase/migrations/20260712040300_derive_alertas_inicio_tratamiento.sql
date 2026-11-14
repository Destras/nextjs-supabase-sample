-- eval_vencida pasa a decidirse por fecha_seguimiento_esperada < current_date
-- (D-1, bug independiente: el criterio anterior, numero_nivel <= mes_actual,
-- contaba el mes en curso como ya vencido). etapa_activa se parte en tres
-- CTEs: etapas_abiertas (todas las en curso, arrancadas o no), etapa_activa
-- (SOLO arrancadas, fecha_inicio is not null — el filtro va ANTES del cálculo
-- de mes_actual porque greatest(1, NULL) devuelve 1, no NULL) y
-- etapa_sin_iniciar (SOLO las que no arrancaron). Se agrega la rama nueva
-- contenido_pendiente, derivada de etapa_sin_iniciar: valor = null
-- (deliberadamente sin progreso de carga) y fecha = etapa.created_at (desde
-- cuándo el paciente espera). etapas_ranked ahora ordena por
-- coalesce(fecha_inicio, created_at::date) en vez de fecha_inicio a secas,
-- para que una etapa cerrada que nunca arrancó (DEC-11) no quede última.
--
-- `db diff` está roto en este ambiente (bug de ordering de is_admin) — esta
-- migración fue hand-authored con el cuerpo COMPLETO de la función (6 ramas)
-- para que quede en sync con supabase/schemas/65_alertas.sql.
--
-- Crítico: create or replace re-agrega el grant global de EXECUTE (PUBLIC y,
-- vía alter default privileges de este proyecto, authenticated). Sin volver a
-- correr los dos revoke de abajo, un terapeuta podría invocar el motor
-- directo y ver toda la red (bypass de RLS, la función es security definer).
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
  etapas_abiertas as (
    -- TODAS las etapas en curso (arrancadas o no). Base común de
    -- etapa_activa y etapa_sin_iniciar.
    select er.id            as etapa_id,
           er.paciente_id,
           er.etapa_ordinal::int as etapa_ordinal,
           er.fecha_inicio,
           er.created_at,
           er.modalidad_id
      from etapas_ranked er
     where er.fecha_finalizacion is null
  ),
  etapa_activa as (
    -- SOLO las arrancadas → alimenta eval_vencida/mes_3/fin/reinicio. El
    -- filtro fecha_inicio is not null va ACÁ, antes del cálculo de
    -- mes_actual (ver nota arriba sobre greatest(1, NULL) = 1).
    select ea.etapa_id,
           ea.paciente_id,
           ea.etapa_ordinal,
           ea.fecha_inicio,
           m.cantidad_niveles,
           least(
             m.cantidad_niveles,
             greatest(
               1,
               (extract(year  from age(current_date, ea.fecha_inicio)) * 12
                + extract(month from age(current_date, ea.fecha_inicio)))::int + 1
             )
           ) as mes_actual
      from etapas_abiertas ea
      join public.modalidades m on m.id = ea.modalidad_id
     where ea.fecha_inicio is not null
  ),
  etapa_sin_iniciar as (
    -- SOLO las que no arrancaron → alimenta contenido_pendiente.
    select ea.etapa_id,
           ea.paciente_id,
           ea.created_at
      from etapas_abiertas ea
     where ea.fecha_inicio is null
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

    -- reinicio: etapa activa no-primera iniciada este mes (per DEC-31).
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
       and date_trunc('month', ea.fecha_inicio) = date_trunc('month', current_date)

    union all

    -- contenido_pendiente: etapa sin iniciar (fecha_inicio is null, ya
    -- filtrada por etapas_abiertas → fecha_finalizacion is null, así que una
    -- etapa cerrada que nunca arrancó (DEC-11) no emite). valor = null,
    -- deliberadamente sin progreso de carga (contarlo duplicaría la regla de
    -- etapa_plan_completo() y crearía una segunda fuente de verdad). fecha =
    -- created_at: desde cuándo este paciente espera.
    select ea.paciente_id,
           p.nombre                                     as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre                                  as terapeuta_nombre,
           'contenido_pendiente'                        as tipo,
           ea.etapa_id::text || ':contenido_pendiente'  as evento_ref,
           null::int                                    as valor,
           ea.created_at                                as fecha
      from etapa_sin_iniciar ea
      join public.pacientes p on p.id = ea.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = ea.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
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
  'Motor compartido del subsistema de alertas: deriva los 6 tipos activos (score_bajo, eval_vencida, mes_3, fin, reinicio, contenido_pendiente) restando las atendidas (alertas_atendidas, left join ... where aa.id is null). eval_vencida se decide por fecha_seguimiento_esperada < current_date (no por índice de mes). Las etapas sin arrancar (fecha_inicio is null) no emiten eval_vencida/mes_3/fin/reinicio, solo contenido_pendiente. Punto único de verdad — lo consumen list_alertas_terapeuta/list_alertas_admin y los counts de get_admin_dashboard_stats/list_terapeutas. Interna: no otorgada a authenticated.';

revoke execute on function public.derive_alertas_activas() from public;
revoke execute on function public.derive_alertas_activas() from authenticated;
