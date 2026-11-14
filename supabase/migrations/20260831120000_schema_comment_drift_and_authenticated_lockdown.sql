-- Reconciliación del schema declarativo con la base real. GENERADA con
-- `supabase db diff` — la primera de este repo que se pudo generar de verdad,
-- porque hasta el fix de orden de carga (branch fix/schema-load-order) db diff
-- ni corría.
--
--
-- ORDEN DE MIGRACIÓN — el timestamp de este archivo es deliberado, no el que
-- generó db diff. Esta migración hace CREATE OR REPLACE de generar_otp_activacion
-- y regenerar_otp_activacion. La rama baja-voluntaria/pr2a-rpc-core les agrega la
-- guarda de baja_voluntaria en 20260831140000. Con el timestamp original
-- (20260831152412) esta migración corría DESPUÉS y borraba esa guarda en silencio:
-- CREATE OR REPLACE reemplaza el cuerpo entero. Se renumeró a 120000 para que
-- corra ANTES y pr2a quede último. Si alguien vuelve a generar este archivo con
-- db diff, revisar el orden de nuevo.

-- Dos cosas, ninguna cosmética:
--
-- 1. REVOKE truncate/trigger a `authenticated` sobre 6 tablas.
--    Estas tablas se crearon DESPUÉS de 20260503232546_fix_permissions.sql, que
--    hizo ese revoke tabla por tabla, así que nunca lo recibieron. Verificado en
--    local: hoy cualquier usuario logueado puede correr
--      truncate public.otps_activacion;
--    y lo mismo sobre alertas_atendidas, algoritmo_frases, causa_frases,
--    contenido_imagenes y tipos_alerta. TRUNCATE NO pasa por RLS, así que las
--    policies no contienen nada de esto. El comentario de otps_activacion dice
--    "RLS lockdown total: solo security definer y service-role pueden acceder";
--    era falso.
--    De acá en adelante el lockdown vive del lado declarativo
--    (supabase/schemas/00_authenticated_lockdown.sql), así que toda tabla nueva
--    lo hereda sin depender de que alguien se acuerde.
--
-- 2. CREATE OR REPLACE de 7 funciones cuyo cuerpo difería SOLO en comentarios y
--    espaciado entre supabase/schemas/ y la base. Se verificó una por una
--    comparando pg_get_functiondef contra el archivo declarativo con los
--    comentarios removidos: derive_alertas_activas, generar_otp_activacion,
--    get_frases_del_tratamiento_activo, list_terapeutas, regenerar_otp_activacion,
--    validar_otp_para_creacion, vincular_cuenta_paciente. Ningún cuerpo cambia
--    de comportamiento.
--
-- Lo que este archivo NO tiene, a propósito: los 52 `grant truncate/trigger ...
-- to authenticated` que db diff emitía antes del punto 1. Eran la shadow DB
-- siendo MÁS permisiva que producción; aplicarlos habría dado TRUNCATE sobre
-- pacientes y profiles, y DELETE/UPDATE sobre audit_log, a cualquier usuario
-- logueado. Se eliminaron en el origen, no filtrando la salida.

revoke trigger on table "public"."alertas_atendidas" from "authenticated";

revoke truncate on table "public"."alertas_atendidas" from "authenticated";

revoke trigger on table "public"."algoritmo_frases" from "authenticated";

revoke truncate on table "public"."algoritmo_frases" from "authenticated";

revoke trigger on table "public"."causa_frases" from "authenticated";

revoke truncate on table "public"."causa_frases" from "authenticated";

revoke trigger on table "public"."contenido_imagenes" from "authenticated";

revoke truncate on table "public"."contenido_imagenes" from "authenticated";

revoke trigger on table "public"."otps_activacion" from "authenticated";

revoke truncate on table "public"."otps_activacion" from "authenticated";

revoke trigger on table "public"."tipos_alerta" from "authenticated";

revoke truncate on table "public"."tipos_alerta" from "authenticated";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.derive_alertas_activas()
 RETURNS TABLE(paciente_id uuid, paciente_nombre text, terapeuta_id uuid, terapeuta_nombre text, tipo text, evento_ref text, valor integer, fecha timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    -- null) → alimenta eval_vencida/mes_3/fin/reinicio. El filtro
    -- fecha_inicio is not null va ACÁ, antes del cálculo de mes_actual (ver
    -- nota arriba sobre greatest(1, NULL) = 1). Post-DEC-12: colapsada
    -- directo sobre etapas_ranked (ya no hay etapa_sin_iniciar que justifique
    -- la CTE intermedia etapas_abiertas).
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
$function$
;

-- generar_otp_activacion: implementación omitida en la versión pública.
CREATE OR REPLACE FUNCTION public.generar_otp_activacion(p_paciente_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_frases_del_tratamiento_activo(p_paciente_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_terapeuta_id uuid;
  v_etapa_id     uuid;
  v_result       jsonb;
begin
  -- 1. Resolver el terapeuta dueño vía la asignación activa del paciente.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  -- 2. Autorizar. Comparación NULL-safe: si v_terapeuta_id no resuelve
  --    (paciente sin asignación activa), `auth.uid() = NULL` daría NULL y el
  --    guard fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue
  --    permitiendo al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and v_terapeuta_id = auth.uid())
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Resolver la etapa activa del paciente (mismo criterio que
  --    get_mi_plan_semanal: fecha_finalizacion IS NULL, la más reciente).
  select et.id into v_etapa_id
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  -- Paciente sin etapa activa -> [] (no lanza: el asignador lo trata como
  -- "sin plan").
  if v_etapa_id is null then
    return '[]'::jsonb;
  end if;

  -- 4. Delegar en frases_de_etapa y agrupar por semana (DEC-0-5).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana', semanas.semana,
      'frases', semanas.frases
    )
    order by semanas.semana
  ), '[]'::jsonb)
  into v_result
  from (
    select f.semana,
           jsonb_agg(
             jsonb_build_object(
               'orden',  f.orden,
               'origen', f.origen,
               'texto',  f.texto
             )
             order by f.orden
           ) as frases
      from public.frases_de_etapa(v_etapa_id) as f
     group by f.semana
  ) as semanas;

  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_terapeutas()
 RETURNS TABLE(id uuid, nombre text, email text, telefono text, estado text, pacientes_activos integer, score_promedio numeric, alertas_activas integer, sin_iniciar integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  --
  -- sin_iniciar (DEC-12, feat/inicio-tratamiento post-implementación):
  -- compensación de la baja del tipo de alerta contenido_pendiente — el
  -- admin supervisa la red desde acá, no desde el widget de onboarding del
  -- terapeuta (ese existe solo en su propio dashboard). Count de pacientes
  -- con asignación activa a ese terapeuta cuya etapa activa (fecha_finalizacion
  -- is null) tiene fecha_inicio is null — la misma definición canónica que
  -- fetchPacientesSinIniciar.ts (dashboard) y el filtro de derive_alertas_activas
  -- (65_alertas.sql). NO usa el código de estado de la etapa. Siempre int
  -- no-nulo (0 filas = 0, sin caso NULL).
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
$function$
;

-- regenerar_otp_activacion: implementación omitida en la versión pública.
CREATE OR REPLACE FUNCTION public.regenerar_otp_activacion(p_paciente_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$function$
;

-- validar_otp_para_creacion: implementación omitida en la versión pública.
CREATE OR REPLACE FUNCTION public.validar_otp_para_creacion(p_otp text, p_fecha_nacimiento date)
 RETURNS TABLE(paciente_id uuid, email text, codigo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$function$
;

-- vincular_cuenta_paciente: implementación omitida en la versión pública.
CREATE OR REPLACE FUNCTION public.vincular_cuenta_paciente(p_otp text, p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  -- Implementación omitida en la versión pública del repositorio.
  -- Ver supabase/functions/README.md.
  raise exception 'omitido en la versión pública';
end;
$function$
;


