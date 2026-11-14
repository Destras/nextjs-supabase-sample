-- DEC-12 (feat/inicio-tratamiento, post-implementación): compensación de la
-- baja de la alerta contenido_pendiente (ver migración hermana
-- 20260713153300_drop_alerta_contenido_pendiente.sql) — el admin supervisa la
-- red desde /terapeutas, no desde el widget "Sin iniciar" del dashboard del
-- terapeuta (ese es personal, no de red). Se agrega sin_iniciar a
-- list_terapeutas(): el count de pacientes con asignación activa a ese
-- terapeuta cuya etapa activa (fecha_finalizacion is null) tiene fecha_inicio
-- is null. Misma definición canónica que fetchPacientesSinIniciar.ts
-- (dashboard) y el filtro de derive_alertas_activas (65_alertas.sql) — NO usa
-- el código de estado de la etapa.
--
-- Migración escrita a mano: `supabase db diff` está roto en este repo (issue
-- pre-existente). Espejo exacto de supabase/schemas/70_rpcs_terapeutas.sql
-- tras el agregado.
--
-- Timestamp 20260713153400: ordena después de 20260713153300 (migración
-- hermana de esta misma tarea).
--
-- `create or replace` no puede cambiar el return type (columnas de OUT
-- parameters) de una función existente — Postgres tira 42P13 ("cannot change
-- return type of existing function"). Hay que `drop` primero (mismo patrón
-- que 20260603175159_dashboard_admin_rpcs.sql cuando list_terapeutas() ganó
-- columnas por primera vez).
drop function if exists public.list_terapeutas();

create or replace function public.list_terapeutas()
returns table(
  id                uuid,
  nombre            text,
  email             text,
  telefono          text,
  estado            text,
  pacientes_activos int,
  score_promedio    numeric,
  alertas_activas   int,
  sin_iniciar       int
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
    sin_iniciar_por_terapeuta as (
      select ap.terapeuta_id,
             count(*)::int as sin_iniciar
        from public.asignaciones_paciente ap
        join public.etapas_tratamiento    et on et.paciente_id = ap.paciente_id
       where ap.fecha_hasta is null
         and et.fecha_finalizacion is null
         and et.fecha_inicio is null
       group by ap.terapeuta_id
    ),
    agg as (
      select ps.terapeuta_id,
             count(*)::int                                                        as pacientes_activos,
             avg(ps.ultimo_score)                                                 as score_promedio,
             coalesce(max(apt.alertas_activas), 0)                                as alertas_activas,
             coalesce(max(sip.sin_iniciar), 0)                                    as sin_iniciar
        from paciente_score ps
        left join alertas_por_terapeuta apt on apt.terapeuta_id = ps.terapeuta_id
        left join sin_iniciar_por_terapeuta sip on sip.terapeuta_id = ps.terapeuta_id
       group by ps.terapeuta_id
    )
    select t.id,
           coalesce(p.nombre, '')                                                 as nombre,
           coalesce(u.email::text, '')                                            as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                         as estado,
           coalesce(agg.pacientes_activos, 0)::int                                as pacientes_activos,
           agg.score_promedio                                                     as score_promedio,
           coalesce(agg.alertas_activas, 0)                                       as alertas_activas,
           coalesce(agg.sin_iniciar, 0)                                           as sin_iniciar
      from public.terapeutas               t
      left join public.profiles            p on p.id = t.id
      left join auth.users                 u on u.id = t.id
      left join public.estados_terapeuta   e on e.id = t.estado_id
      left join agg                          on agg.terapeuta_id = t.id;
end;
$$;

comment on function public.list_terapeutas is
  'Lista todos los terapeutas con email (de auth.users), teléfono, estado (codigo), conteo de pacientes activos y, para el dashboard admin, score_promedio (NULL si ningún paciente activo tiene evaluaciones), alertas_activas (D4: count de derive_alertas_activas() por terapeuta, siempre int no-nulo) y sin_iniciar (DEC-12: count de pacientes activos del terapeuta cuya etapa activa tiene fecha_inicio is null, siempre int no-nulo — compensación de la baja de la alerta contenido_pendiente). Guarda is_admin(). Set returning.';

grant execute on function public.list_terapeutas() to authenticated;
