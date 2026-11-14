-- Modelo clínico: get_admin_dashboard_stats reescrita.
-- distribucionEtapa pasa de ceil(nivel_actual/2) al ordinal real del ciclo
-- (row_number por fecha_inicio,id). Se agrega distribucionMes (mes calendario,
-- 1..N, topado en cantidad_niveles de la modalidad — la etapa dura N meses, 4 o
-- más, 1 eval/mes). Se elimina el CTE nivel_actual (ya no lo usa nadie).
-- Migración escrita a mano: `supabase db diff` falla por el orden de
-- schemas (referencia is_admin() antes de 25_admin_functions.sql),
-- issue pre-existente y ajeno a este cambio. Refleja exactamente
-- supabase/schemas/62_rpc_admin.sql.

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
           et.causa_id,
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
           ea.causa_id,
           ea.etapa_ordinal,
           ea.fecha_inicio                                              as etapa_inicio,
           m.cantidad_niveles
      from activos a
      join public.pacientes pa on pa.id = a.paciente_id
      left join lateral (
        select er.id, er.causa_id, er.modalidad_id, er.etapa_ordinal, er.fecha_inicio
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
           pm.causa_id,
           pm.etapa_ordinal,
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
      'alertas_activas', (
        select case
                 when count(ultimo_score) > 0
                 then count(*) filter (where ultimo_score <= 3)::int
                 else null
               end
          from paciente_calc
      ),
      'score_promedio', (
        select round(avg(ultimo_score), 1) from paciente_calc
      )
    ),
    'distribucionCausa', coalesce((
      select jsonb_agg(d order by d.cantidad desc, d.label)
        from (
          select coalesce(c.nombre, 'Sin clasificar') as label,
                 count(*)::int                        as cantidad
            from paciente_calc pn
            left join public.causas c on c.id = pn.causa_id
           group by coalesce(c.nombre, 'Sin clasificar')
        ) d
    ), '[]'::jsonb),
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
  'Agregados globales de la red para el dashboard admin: totales (pacientes activos, nuevos del mes, alertas activas, score promedio) + distribución por causa raíz, por etapa (ordinal del ciclo) y por mes de tratamiento (calendario, 1..N). jsonb único. Guarda is_admin(). Métricas Tier B (alertas/score) NULL si ningún paciente activo tiene evaluaciones. Modelo: etapa = tratamiento de N meses (def. modalidad), 1 eval/mes; etapa_ordinal ⊥ mes_actual.';

grant execute on function public.get_admin_dashboard_stats() to authenticated;
