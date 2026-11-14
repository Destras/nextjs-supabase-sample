-- ---------------------------------------------------------------------------
-- list_alertas_admin
-- ---------------------------------------------------------------------------
-- Alertas activas de la red, scoped por rol admin. Filtra
-- derive_alertas_activas() opcionalmente por terapeuta_id — el drill-down del
-- admin (Task 2.3) invoca con el terapeuta_id de la fila de list_terapeutas;
-- p_terapeuta_id null devuelve la red completa (soportado, pero la UI del MVP
-- no lo usa todavía). Guard: is_admin(), a diferencia de
-- list_alertas_terapeuta cuyo scoping es el propio enforcement.
create or replace function public.list_alertas_admin(p_terapeuta_id uuid default null)
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
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  return query
    select d.paciente_id,
           d.paciente_nombre,
           d.terapeuta_id,
           d.terapeuta_nombre,
           d.tipo,
           d.evento_ref,
           d.valor,
           d.fecha
      from public.derive_alertas_activas() d
     where p_terapeuta_id is null or d.terapeuta_id = p_terapeuta_id;
end;
$$;

comment on function public.list_alertas_admin(uuid) is
  'Alertas activas de la red (admin). Guarda is_admin(). p_terapeuta_id filtra por terapeuta (usado por el drill-down de Task 2.3); null devuelve toda la red (soportado, sin uso en la UI del MVP). Devuelve las 8 columnas del motor derive_alertas_activas().';

grant execute on function public.list_alertas_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- list_terapeutas — rewire de alertas_activas al subsistema (D4)
-- ---------------------------------------------------------------------------
create or replace function public.list_terapeutas()
returns table(
  id                uuid,
  nombre            text,
  email             text,
  telefono          text,
  estado            text,
  pacientes_activos int,
  score_promedio    numeric,
  alertas_activas   int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- score_promedio: extensión aditiva del dashboard admin. "último score" de
  -- un paciente = score del nivel_evaluacion con max fecha_respuesta entre
  -- todos sus niveles (cross-etapa). NULL cuando ningún paciente activo del
  -- terapeuta tiene evaluaciones (Tier B sin data, distinto de 0). Se agrega
  -- por terapeuta en CTEs para no producir fan-out sobre el join de
  -- asignaciones. alertas_activas (D4) ya NO deriva del score: es el count
  -- del subsistema derive_alertas_activas() (65_alertas.sql) por terapeuta —
  -- siempre int no-nulo (0 filas = 0 alertas, sin caso NULL).
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
    alertas_por_terapeuta as (
      select d.terapeuta_id,
             count(*)::int as alertas_activas
        from public.derive_alertas_activas() d
       group by d.terapeuta_id
    ),
    agg as (
      select ps.terapeuta_id,
             count(*)::int                                                        as pacientes_activos,
             avg(ps.ultimo_score)                                                 as score_promedio,
             coalesce(max(apt.alertas_activas), 0)                                as alertas_activas
        from paciente_score ps
        left join alertas_por_terapeuta apt on apt.terapeuta_id = ps.terapeuta_id
       group by ps.terapeuta_id
    )
    select t.id,
           coalesce(p.nombre, '')                                                 as nombre,
           coalesce(u.email::text, '')                                            as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                         as estado,
           coalesce(agg.pacientes_activos, 0)::int                                as pacientes_activos,
           agg.score_promedio                                                     as score_promedio,
           coalesce(agg.alertas_activas, 0)                                       as alertas_activas
      from public.terapeutas               t
      left join public.profiles            p on p.id = t.id
      left join auth.users                 u on u.id = t.id
      left join public.estados_terapeuta   e on e.id = t.estado_id
      left join agg                          on agg.terapeuta_id = t.id;
end;
$$;

comment on function public.list_terapeutas is
  'Lista todos los terapeutas con email (de auth.users), teléfono, estado (codigo), conteo de pacientes activos y, para el dashboard admin, score_promedio (NULL si ningún paciente activo tiene evaluaciones) y alertas_activas (D4: count de derive_alertas_activas() por terapeuta, siempre int no-nulo). Guarda is_admin(). Set returning.';

grant execute on function public.list_terapeutas() to authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_dashboard_stats — rewire de totales.alertas_activas al subsistema (D4)
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
      -- etapa activa del paciente (la de fecha_finalizacion null)
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
  'Agregados globales de la red para el dashboard admin: totales (pacientes activos, nuevos del mes, alertas activas, score promedio) + distribución por causa raíz, por etapa (ordinal del ciclo) y por mes de tratamiento (calendario, 1..N). jsonb único. Guarda is_admin(). score_promedio NULL si ningún paciente activo tiene evaluaciones; alertas_activas (D4) es el count de derive_alertas_activas(), siempre int no-nulo. Modelo: etapa = tratamiento de N meses (def. modalidad), 1 eval/mes; etapa_ordinal ⊥ mes_actual.';

grant execute on function public.get_admin_dashboard_stats() to authenticated;
