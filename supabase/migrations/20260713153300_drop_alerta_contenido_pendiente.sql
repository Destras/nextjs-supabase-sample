-- DEC-12 (feat/inicio-tratamiento, post-implementación): reversión de
-- producto — el usuario vio la feature funcionando en el browser y decidió
-- que la alerta contenido_pendiente es redundante con el widget "Sin iniciar"
-- del dashboard del terapeuta (ya la muestra ahí). Se saca el 6to tipo del
-- motor de alertas (derive_alertas_activas, 65_alertas.sql), del catálogo
-- (tipos_alerta, 63_tipos_alerta.sql) y del whitelist de
-- marcar_alerta_atendida (66_alertas_terapeuta.sql). El engine vuelve a los
-- 5 tipos (score_bajo, eval_vencida, mes_3, fin, reinicio).
--
-- El admin NO pierde visibilidad: la migración hermana
-- 20260713153400_list_terapeutas_sin_iniciar.sql agrega sin_iniciar a
-- list_terapeutas() para compensar (columna nueva en /terapeutas).
--
-- CRÍTICO: el filtro `where ea.fecha_inicio is not null` de la CTE
-- etapa_activa (ahora colapsada directo sobre etapas_ranked) se preserva
-- INTACTO — es lo que evita que una etapa sin arrancar dispare
-- eval_vencida/mes_3/fin/reinicio falsos (greatest(1, NULL) = 1 en Postgres,
-- no NULL). Esta migración NO lo toca.
--
-- FK: alertas_atendidas.tipo referencia tipos_alerta(codigo) — hay que borrar
-- los dismissals de contenido_pendiente ANTES de borrar la fila del catálogo.
--
-- Migración escrita a mano: `supabase db diff` está roto en este repo (issue
-- pre-existente, documentado en 20260627185526_modelo_clinico_admin_stats.sql
-- y reconfirmado en varias migraciones de esta rama). Espejo exacto de
-- supabase/schemas/65_alertas.sql, 63_tipos_alerta.sql y
-- 66_alertas_terapeuta.sql tras la baja.
--
-- Timestamp 20260713153300: ordena después de 20260713153200 (última
-- migración aterrizada en esta rama).

-- ---------------------------------------------------------------------------
-- 1. derive_alertas_activas: vuelve a los 5 tipos, sin etapa_sin_iniciar.
-- ---------------------------------------------------------------------------
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
    select distinct ap.paciente_id
      from public.asignaciones_paciente ap
     where ap.fecha_hasta is null
  ),
  terapeuta_activo as (
    select ap.paciente_id,
           ap.terapeuta_id
      from public.asignaciones_paciente ap
     where ap.fecha_hasta is null
  ),
  etapas_ranked as (
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
    -- null) → alimenta eval_vencida/mes_3/fin/reinicio. El filtro
    -- fecha_inicio is not null va ACÁ, antes del cálculo de mes_actual:
    -- greatest(1, NULL) devuelve 1 (no NULL), así que una etapa sin arrancar
    -- que llegara a este cálculo saldría con mes_actual = 1 y dispararía
    -- eval_vencida sobre su nivel 1 — el bug original resucitado. Este
    -- filtro NO se toca en esta migración.
    select er.id            as etapa_id,
           er.paciente_id,
           er.etapa_ordinal::int as etapa_ordinal,
           er.fecha_inicio,
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
       and er.fecha_inicio is not null
  ),
  derivadas as (
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
  'Motor compartido del subsistema de alertas: deriva los 5 tipos activos (score_bajo, eval_vencida, mes_3, fin, reinicio) restando las atendidas (alertas_atendidas, left join ... where aa.id is null). eval_vencida se decide por fecha_seguimiento_esperada < current_date (no por índice de mes). Las etapas sin arrancar (fecha_inicio is null) no emiten NINGUNA de las 5 (DEC-12 sacó contenido_pendiente, el 6to tipo que las señalizaba — esa señal vive ahora en el widget "Sin iniciar" del dashboard del terapeuta y en list_terapeutas.sin_iniciar para el admin). Punto único de verdad — lo consumen list_alertas_terapeuta/list_alertas_admin y los counts de get_admin_dashboard_stats/list_terapeutas. Interna: no otorgada a authenticated.';

-- Postgres otorga EXECUTE por default en dos niveles: el grant PUBLIC
-- implícito Y, en este proyecto, un "alter default privileges" que además
-- otorga execute a `authenticated` en toda función nueva del schema public.
-- Sin revocar AMBOS, un terapeuta podría invocar el motor directamente y, al
-- ser security definer, ver TODA la red (bypassea RLS). `create or replace`
-- re-agrega el grant global — hay que volver a correr estos dos revokes.
revoke execute on function public.derive_alertas_activas() from public;
revoke execute on function public.derive_alertas_activas() from authenticated;

-- ---------------------------------------------------------------------------
-- 2. tipos_alerta: borrar dismissals primero (FK), después la fila del catálogo.
-- ---------------------------------------------------------------------------
delete from public.alertas_atendidas where tipo = 'contenido_pendiente';
delete from public.tipos_alerta where codigo = 'contenido_pendiente';

comment on table public.tipos_alerta is 'Catálogo de metadata de presentación de los tipos de alerta (score_bajo, eval_vencida, mes_3, fin). No dispara nada por sí solo: la lógica de cuándo se activa cada tipo vive en derive_alertas_activas().';

-- ---------------------------------------------------------------------------
-- 3. marcar_alerta_atendida: whitelist vuelve a los 5 tipos vigentes.
-- ---------------------------------------------------------------------------
create or replace function public.marcar_alerta_atendida(
  p_tipo        text,
  p_evento_ref  text,
  p_paciente_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
begin
  if not public.has_active_assignment(p_paciente_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_tipo not in ('score_bajo', 'eval_vencida', 'mes_3', 'fin', 'reinicio') then
    raise exception 'tipo_invalido' using errcode = '23514';
  end if;

  select a.terapeuta_id
    into v_terapeuta_id
    from public.asignaciones_paciente a
   where a.paciente_id = p_paciente_id
     and a.fecha_hasta is null;

  insert into public.alertas_atendidas (tipo, evento_ref, paciente_id, terapeuta_id, atendida_por)
  values (p_tipo, p_evento_ref, p_paciente_id, v_terapeuta_id, auth.uid())
  on conflict (tipo, evento_ref, paciente_id) do nothing;
end;
$$;

comment on function public.marcar_alerta_atendida(text, text, uuid) is
  'Marca una alerta derivada (tipo, evento_ref) como atendida para el paciente dado. Guard null-safe: has_active_assignment(p_paciente_id) — solo el terapeuta dueño, el admin no marca. terapeuta_id se resuelve del asignado activo del paciente. Idempotente: unique(tipo, evento_ref, paciente_id) + on conflict do nothing. p_tipo valida contra los 5 tipos vigentes (incluye reinicio, feat/nuevo-tratamiento; contenido_pendiente se dio de baja por DEC-12, feat/inicio-tratamiento).';

grant execute on function public.marcar_alerta_atendida(text, text, uuid) to authenticated;
