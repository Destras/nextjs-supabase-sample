-- Task fix-review (dashboard): get_admin_dashboard_stats.distribucionMes deja
-- de agrupar solo los meses ocupados y pasa a emitir SIEMPRE los meses 1..N
-- (N = max cantidad_niveles entre pacientes activos), con 0 en los meses sin
-- pacientes hoy, más el bucket "Sin etapa" aparte. Root cause del bug: al
-- agrupar solo por mes_actual, el mes con más pacientes ocupado se confundía
-- con el último mes del tratamiento y deriveProyeccionMesSiguiente perdía la
-- cohorte que en realidad cierra recién el mes siguiente.
-- Migración escrita a mano: `supabase db diff` falla por el mismo issue
-- pre-existente y ajeno a este cambio documentado en
-- 20260627185526_modelo_clinico_admin_stats.sql (11_profiles.sql referencia
-- is_admin() antes de que 25_admin_functions.sql la declare). Refleja
-- exactamente supabase/schemas/62_rpc_admin.sql.

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
    -- ordinal del ciclo por paciente (1,2,3…), ordenado por fecha_inicio con
    -- desempate determinista por id. Independiente del mes (no es ceil/2).
    select et.id,
           et.paciente_id,
           et.modalidad_id,
           et.fecha_inicio,
           et.fecha_finalizacion,
           row_number() over (
             partition by et.paciente_id
             order by et.fecha_inicio, et.id
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
           -- mes de tratamiento por calendario: meses completos desde el inicio
           -- de la etapa activa (lógica day-of-month vía age()), base 1, topado
           -- en cantidad_niveles (variable por modalidad, NO hardcodeado 4).
           case
             when pm.etapa_activa_id is null then null
             else least(
                    coalesce(pm.cantidad_niveles, 1),
                    greatest(
                      1,
                      (extract(year  from age(current_date, pm.etapa_inicio)) * 12
                       + extract(month from age(current_date, pm.etapa_inicio)))::int + 1
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
  'Agregados globales de la red para el dashboard admin: totales (pacientes activos, nuevos del mes, alertas activas, score promedio, en_mes_3, fin_tratamiento) + distribución por etapa (ordinal del ciclo) y por mes de tratamiento (calendario). distribucionMes emite SIEMPRE los meses 1..N completos (N = max cantidad_niveles entre pacientes activos), con 0 en los meses sin pacientes hoy, más el bucket "Sin etapa" aparte cuando corresponde — así el consumidor (deriveProyeccionMesSiguiente) conoce el largo real del tratamiento aunque el último mes esté vacío. distribucionEtapa sigue agrupando solo ordinales ocupados (rango no acotado). Ya NO emite distribucionCausa (decisión de producto: esa estadística vive en el diagnóstico). jsonb único. Guarda is_admin(). score_promedio NULL si ningún paciente activo tiene evaluaciones; alertas_activas (D4) es el count de derive_alertas_activas(), siempre int no-nulo. en_mes_3/fin_tratamiento son counts sobre mes_actual, este último comparado contra cantidad_niveles (no hardcodea 4) para ser robusto a otras modalidades. Modelo: etapa = tratamiento de N meses (def. modalidad), 1 eval/mes; etapa_ordinal ⊥ mes_actual.';

grant execute on function public.get_admin_dashboard_stats() to authenticated;
