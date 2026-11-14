-- Task C.1.1 (dashboard): get_admin_dashboard_stats pierde distribucionCausa
-- (decisión de producto: la estadística de causa raíz se movió al diagnóstico)
-- y suma totales.en_mes_3 / totales.fin_tratamiento (counts sobre mes_actual,
-- este último comparado contra cantidad_niveles -no hardcodeado 4- para ser
-- robusto a otras modalidades). cantidad_niveles se arrastra hasta
-- paciente_calc para poder hacer esa comparación.
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
    'distribucionMes', coalesce((
      select jsonb_agg(jsonb_build_object('label', d.label, 'cantidad', d.cantidad) order by d.orden)
        from (
          select case
                   when pn.mes_actual is null then 'Sin etapa'
                   else pn.mes_actual::text
                 end          as label,
                 count(*)::int as cantidad,
                 coalesce(pn.mes_actual, 2147483647) as orden
            from paciente_calc pn
           group by pn.mes_actual
        ) d
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_dashboard_stats is
  'Agregados globales de la red para el dashboard admin: totales (pacientes activos, nuevos del mes, alertas activas, score promedio, en_mes_3, fin_tratamiento) + distribución por etapa (ordinal del ciclo) y por mes de tratamiento (calendario, 1..N). Ya NO emite distribucionCausa (decisión de producto: esa estadística vive en el diagnóstico). jsonb único. Guarda is_admin(). score_promedio NULL si ningún paciente activo tiene evaluaciones; alertas_activas (D4) es el count de derive_alertas_activas(), siempre int no-nulo. en_mes_3/fin_tratamiento son counts sobre mes_actual, este último comparado contra cantidad_niveles (no hardcodea 4) para ser robusto a otras modalidades. Modelo: etapa = tratamiento de N meses (def. modalidad), 1 eval/mes; etapa_ordinal ⊥ mes_actual.';

grant execute on function public.get_admin_dashboard_stats() to authenticated;
