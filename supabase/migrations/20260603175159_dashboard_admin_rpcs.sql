-- Dashboard admin (E2.1): extensión aditiva de list_terapeutas + RPC nuevo
-- get_admin_dashboard_stats + índice de soporte.
--
-- NOTA: el `supabase db diff` arrastró drift pre-existente (grants
-- trigger/truncate por defecto, recreación de policies, drop de una policy de
-- storage). Esta migración fue editada a mano para contener SOLO los cambios de
-- esta task. Los `grant execute on function` se agregan manualmente porque el
-- diff no detecta grants ni el proconfig search_path.

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- list_terapeutas: + score_promedio, + alertas_activas (cambio de firma → drop)
-- ---------------------------------------------------------------------------
drop function if exists public.list_terapeutas();

create or replace function public.list_terapeutas()
 returns table(id uuid, nombre text, email text, telefono text, estado text, pacientes_activos integer, score_promedio numeric, alertas_activas integer)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- score_promedio / alertas_activas: extensión aditiva del dashboard admin.
  -- "último score" de un paciente = score del nivel_evaluacion con max
  -- fecha_respuesta entre todos sus niveles (cross-etapa). Ambas columnas son
  -- NULL cuando ningún paciente activo del terapeuta tiene evaluaciones (Tier B
  -- sin data, distinto de 0). Se agregan por terapeuta en CTEs para no producir
  -- fan-out sobre el join de asignaciones.
  return query
    with paciente_score as (
      select ap.terapeuta_id,
             ap.paciente_id,
             (
               select ev.score
                 from public.nivel_evaluacion   ev
                 join public.niveles            n  on n.id  = ev.nivel_id
                 join public.etapas_tratamiento et on et.id = n.etapa_id
                where et.paciente_id = ap.paciente_id
                order by ev.fecha_respuesta desc
                limit 1
             )                                                                    as ultimo_score
        from public.asignaciones_paciente ap
       where ap.fecha_hasta is null
    ),
    agg as (
      select ps.terapeuta_id,
             count(*)::int                                                        as pacientes_activos,
             avg(ps.ultimo_score)                                                 as score_promedio,
             case
               when count(ps.ultimo_score) > 0
               then count(*) filter (where ps.ultimo_score <= 3)::int
               else null
             end                                                                  as alertas_activas
        from paciente_score ps
       group by ps.terapeuta_id
    )
    select t.id,
           coalesce(p.nombre, '')                                                 as nombre,
           coalesce(u.email::text, '')                                            as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                         as estado,
           coalesce(agg.pacientes_activos, 0)::int                                as pacientes_activos,
           agg.score_promedio                                                     as score_promedio,
           agg.alertas_activas                                                    as alertas_activas
      from public.terapeutas               t
      left join public.profiles            p on p.id = t.id
      left join auth.users                 u on u.id = t.id
      left join public.estados_terapeuta   e on e.id = t.estado_id
      left join agg                          on agg.terapeuta_id = t.id;
end;
$function$
;

grant execute on function public.list_terapeutas() to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_dashboard_stats: agregados globales de la red (jsonb único)
-- ---------------------------------------------------------------------------
create or replace function public.get_admin_dashboard_stats()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
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
           ea.causa_id
      from activos a
      join public.pacientes pa on pa.id = a.paciente_id
      left join lateral (
        select et.id, et.causa_id
          from public.etapas_tratamiento et
         where et.paciente_id = a.paciente_id
           and et.fecha_finalizacion is null
         order by et.fecha_inicio desc
         limit 1
      ) ea on true
  ),
  paciente_nivel as (
    select pm.paciente_id,
           pm.fecha_alta,
           pm.ultimo_score,
           pm.causa_id,
           -- nivel actual: primer numero_nivel asc sin fecha_seguimiento_real;
           -- si todos completos, el max; null si la etapa activa no tiene
           -- niveles o no hay etapa activa.
           coalesce(
             (
               select n.numero_nivel
                 from public.niveles n
                where n.etapa_id = pm.etapa_activa_id
                  and n.fecha_seguimiento_real is null
                order by n.numero_nivel asc
                limit 1
             ),
             (
               select max(n.numero_nivel)
                 from public.niveles n
                where n.etapa_id = pm.etapa_activa_id
             )
           )                                                            as nivel_actual
      from paciente_meta pm
  )
  select jsonb_build_object(
    'totales', jsonb_build_object(
      'pacientes_activos', (select count(*)::int from paciente_nivel),
      'nuevos_mes', (
        select count(*)::int
          from paciente_nivel
         where fecha_alta is not null
           and date_trunc('month', fecha_alta) = date_trunc('month', current_date)
      ),
      'alertas_activas', (
        select case
                 when count(ultimo_score) > 0
                 then count(*) filter (where ultimo_score <= 3)::int
                 else null
               end
          from paciente_nivel
      ),
      'score_promedio', (
        select round(avg(ultimo_score), 1) from paciente_nivel
      )
    ),
    'distribucionCausa', coalesce((
      select jsonb_agg(d order by d.cantidad desc, d.label)
        from (
          select coalesce(c.nombre, 'Sin clasificar') as label,
                 count(*)::int                        as cantidad
            from paciente_nivel pn
            left join public.causas c on c.id = pn.causa_id
           group by coalesce(c.nombre, 'Sin clasificar')
        ) d
    ), '[]'::jsonb),
    'distribucionEtapa', coalesce((
      select jsonb_agg(d order by d.label)
        from (
          select case
                   when pn.nivel_actual is null then 'Sin nivel'
                   else ceil(pn.nivel_actual::numeric / 2)::int::text
                 end          as label,
                 count(*)::int as cantidad
            from paciente_nivel pn
           group by case
                      when pn.nivel_actual is null then 'Sin nivel'
                      else ceil(pn.nivel_actual::numeric / 2)::int::text
                    end
        ) d
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$function$
;

grant execute on function public.get_admin_dashboard_stats() to authenticated;

-- ---------------------------------------------------------------------------
-- Índice de soporte para los lookups por paciente (etapa activa + niveles)
-- ---------------------------------------------------------------------------
create index if not exists etapas_tratamiento_paciente_id_idx
  on public.etapas_tratamiento (paciente_id);
