-- Motor núcleo derive_alertas_activas(): deriva los 4 tipos de alerta activos
-- del MVP (score_bajo, eval_vencida, mes_3, fin) y resta las atendidas. Porta
-- el motor de v1 (feat/alertas:supabase/schemas/65_alertas.sql) con un
-- cambio: se elimina la rama `reinicio` del `union all` (fuera del MVP).
-- Hardening crítico: revoke execute de `public` y de `authenticated`, porque
-- el proyecto tiene un `alter default privileges ... grant to authenticated`
-- global que de otro modo dejaría a cualquier terapeuta invocar el motor
-- security definer directo y ver toda la red.
--
-- Escrita a mano (no via `supabase db diff`): el diff en frío está roto por
-- un bug pre-existente contra 11_profiles/25_admin_functions. Mirrors
-- supabase/schemas/65_alertas.sql exactamente.

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
    -- ordinal del ciclo por paciente (1,2,3…), ordenado por fecha_inicio con
    -- desempate determinista por id. Igual criterio que
    -- get_admin_dashboard_stats.
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
  etapa_activa as (
    -- etapa activa (fecha_finalizacion is null) de cada paciente + su
    -- mes_actual por calendario, topado en cantidad_niveles de la modalidad.
    select er.id                        as etapa_id,
           er.paciente_id,
           er.etapa_ordinal::int        as etapa_ordinal,
           m.cantidad_niveles,
           least(
             m.cantidad_niveles,
             greatest(
               1,
               (extract(year  from age(current_date, er.fecha_inicio)) * 12
                + extract(month from age(current_date, er.fecha_inicio)))::int + 1
             )
           ) as mes_actual
      from etapas_ranked er
      join public.modalidades m on m.id = er.modalidad_id
     where er.fecha_finalizacion is null
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

    -- eval_vencida: nivel más viejo de la etapa activa cuyo mes ya pasó y sin
    -- nivel_evaluacion (el más antiguo cuando hay varios vencidos). El
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
           and n.numero_nivel <= ea.mes_actual
           and not exists (
             select 1 from public.nivel_evaluacion ev where ev.nivel_id = n.id
           )
         order by n.numero_nivel asc
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
  'Motor compartido del subsistema de alertas: deriva los 4 tipos activos del MVP (score_bajo, eval_vencida, mes_3, fin) restando las atendidas (alertas_atendidas, left join ... where aa.id is null). `reinicio` queda fuera del MVP (feat/nuevo-tratamiento). Punto único de verdad — lo consumen list_alertas_terapeuta/list_alertas_admin y los counts de get_admin_dashboard_stats/list_terapeutas. Interna: no otorgada a authenticated.';

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
revoke execute on function public.derive_alertas_activas() from public;
revoke execute on function public.derive_alertas_activas() from authenticated;
