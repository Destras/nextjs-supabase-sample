-- Mirrors supabase/schemas/63_tipos_alerta.sql (descartable column + seed
-- row), supabase/schemas/65_alertas.sql (derive_alertas_activas),
-- supabase/schemas/66_alertas_terapeuta.sql (marcar_alerta_atendida),
-- supabase/schemas/71_rpcs_pacientes.sql (cerrar_etapa),
-- supabase/schemas/76_rpcs_baja_voluntaria.sql (baja_voluntaria_paciente).
--
-- Hand-authored (db diff is broken here — see M1's header). Statement order
-- matches design §2 M4 exactly: column -> seed row -> marcar_alerta_atendida
-- -> derive_alertas_activas -> cerrar_etapa -> baja_voluntaria_paciente.
--
-- Must run AFTER M3 (20260920210200_rpcs_mediciones.sql): cerrar_etapa and
-- baja_voluntaria_paciente below both call public._generar_cierre_automatico,
-- defined there.
--
-- 🔴 CRITICAL — M4 alone is NOT deployable. Steps 4 and 6 below each
-- `create or replace` a function whose access control depends entirely on an
-- EXECUTE revoke (derive_alertas_activas is private; baja_voluntaria_paciente's
-- ENTIRE anti-IDOR defense is its revoke — see 76_rpcs_baja_voluntaria.sql:179-190).
-- This project's `alter default privileges ... grant execute on functions to
-- authenticated, service_role` re-triggers on every `create or replace`, so
-- both functions are re-born grantable to `authenticated` the instant this
-- migration runs. M5 (20260920210400_mediciones_grants.sql) closes that
-- window and MUST ship in the SAME `db push` as this file. Never M4 alone.
--
-- sdd/medir-chakras PR1 (E0: Database & Security Foundation), design §2 M4.

-- ---------------------------------------------------------------------------
-- 1. tipos_alerta.descartable
-- ---------------------------------------------------------------------------
-- No requiere backfill: PG >= 11 aplica un default no-volátil sin reescribir
-- la tabla, así que las 5 filas existentes (score_bajo, eval_vencida, mes_3,
-- fin, reinicio) quedan en true, reproduciendo exactamente el allowlist
-- hardcodeado anterior de marcar_alerta_atendida.

alter table public.tipos_alerta add column descartable boolean not null default true;

comment on column public.tipos_alerta.descartable is
  'Si el terapeuta puede marcar la alerta como atendida (marcar_alerta_atendida, DEC-32 medir-chakras) — catálogo, reemplaza el allowlist hardcodeado anterior. Default true reproduce exactamente el comportamiento previo para los 5 tipos preexistentes; medicion_cierre_pendiente es el único false (defense in depth: no debe poder descartarse, solo se resuelve cerrando la etapa con medición).';

-- ---------------------------------------------------------------------------
-- 2. Seed: medicion_cierre_pendiente
-- ---------------------------------------------------------------------------

insert into public.tipos_alerta (codigo, nombre, prioridad, orden, icono, descartable) values
  ('medicion_cierre_pendiente', 'Medición de cierre pendiente', 'alta', 6, '◎', false)
on conflict (codigo) do nothing;

-- ---------------------------------------------------------------------------
-- 3. marcar_alerta_atendida — catalog lookup (DEC-32)
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
  v_descartable  boolean;
begin
  if not public.has_active_assignment(p_paciente_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select ta.descartable into v_descartable
    from public.tipos_alerta ta
   where ta.codigo = p_tipo;

  if not coalesce(v_descartable, false) then
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
  'Marca una alerta derivada (tipo, evento_ref) como atendida para el paciente dado. Guard null-safe: has_active_assignment(p_paciente_id) — solo el terapeuta dueño, el admin no marca. terapeuta_id se resuelve del asignado activo del paciente. Idempotente: unique(tipo, evento_ref, paciente_id) + on conflict do nothing. p_tipo se valida contra tipos_alerta.descartable (DEC-32, medir-chakras) — coalesce(...,false) fail-closed ante un código desconocido. Reproduce el allowlist anterior de 5 tipos y rechaza medicion_cierre_pendiente.';

-- ---------------------------------------------------------------------------
-- 4. derive_alertas_activas — medicion_cierre_pendiente branch
-- ---------------------------------------------------------------------------
-- 🔴 Función privada — el EXECUTE revoke de este archivo se re-aplica en M5
-- (20260920210400_mediciones_grants.sql), que debe correr en el MISMO
-- `db push` que esta migración.

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
    select er.id            as etapa_id,
           er.paciente_id,
           er.etapa_ordinal::int as etapa_ordinal,
           er.fecha_inicio,
           m.cantidad_niveles,
           public.semanas_de_etapa(er.id) as semanas,
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

    union all

    -- medicion_cierre_pendiente (medir-chakras, DEC-32/DEC-33): etapa activa
    -- dentro de su última semana de contenido, todavía sin medición de
    -- cierre. Sin techo superior: sigue activa hasta que la etapa se cierre.
    select ea.paciente_id,
           p.nombre                                 as paciente_nombre,
           ta.terapeuta_id,
           prof.nombre                              as terapeuta_nombre,
           'medicion_cierre_pendiente'               as tipo,
           ea.etapa_id::text || ':medicion_cierre'   as evento_ref,
           null::int                                 as valor,
           (ea.fecha_inicio + ((ea.semanas - 1) * 7))::timestamptz as fecha
      from etapa_activa ea
      join public.pacientes p on p.id = ea.paciente_id
      left join terapeuta_activo ta on ta.paciente_id = ea.paciente_id
      left join public.profiles prof on prof.id = ta.terapeuta_id
     where current_date >= ea.fecha_inicio + ((ea.semanas - 1) * 7)
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
  'Motor compartido del subsistema de alertas: deriva los 6 tipos activos (score_bajo, eval_vencida, mes_3, fin, reinicio, medicion_cierre_pendiente — medir-chakras) restando las atendidas (alertas_atendidas, left join ... where aa.id is null). eval_vencida se decide por fecha_seguimiento_esperada < current_date (no por índice de mes). medicion_cierre_pendiente activa cuando current_date >= fecha_inicio + (semanas_de_etapa - 1) * 7 y NO es descartable (tipos_alerta.descartable = false): se resuelve cerrando la etapa con medición. Las etapas sin arrancar (fecha_inicio is null) no emiten NINGUNA de las 6 (DEC-12 sacó contenido_pendiente, el tipo original que las señalizaba — esa señal vive ahora en el widget "Sin iniciar" del dashboard del terapeuta y en list_terapeutas.sin_iniciar para el admin). Punto único de verdad — lo consumen list_alertas_terapeuta/list_alertas_admin y los counts de get_admin_dashboard_stats/list_terapeutas. Interna: no otorgada a authenticated.';

-- ---------------------------------------------------------------------------
-- 5. cerrar_etapa — DEC-31 authz + DEC-33 conditional guard + cierre_automatico hook
-- ---------------------------------------------------------------------------

create or replace function public.cerrar_etapa(
  p_paciente_id uuid,
  p_estado      text,
  p_motivo      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id     uuid;
  v_fecha_inicio date;
  v_estado_id    uuid;
begin
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by coalesce(et.fecha_inicio, et.created_at::date) desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'etapa_activa_no_encontrada'
      using errcode = 'P0002',
            detail  = 'el paciente no tiene una etapa de tratamiento activa';
  end if;

  if not (public.is_admin() or public.has_active_assignment(p_paciente_id)) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_estado not in ('finalizada', 'abandonada') then
    raise exception 'estado_invalido'
      using errcode = 'P0001',
            detail  = 'p_estado debe ser ''finalizada'' o ''abandonada''';
  end if;

  select ee.id into v_estado_id
    from public.estados_etapa as ee
   where ee.codigo = p_estado;

  if not found then
    raise exception 'estado_etapa_no_encontrado'
      using errcode = 'P0002',
            detail  = 'p_estado no coincide con ningún código de estados_etapa';
  end if;

  if p_estado = 'finalizada'
     and v_fecha_inicio is not null
     and public.has_active_assignment(p_paciente_id) then
    raise exception 'medicion_cierre_requerida'
      using errcode = 'P0001',
            detail  = 'usar cerrar_etapa_con_medicion';
  end if;

  perform public._generar_cierre_automatico(v_etapa_id);

  update public.etapas_tratamiento
     set fecha_finalizacion = current_date,
         estado_id          = v_estado_id,
         motivo_cierre      = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v_etapa_id;
end;
$$;

comment on function public.cerrar_etapa(uuid, text, text) is
  'Cierra la etapa activa de un paciente con un estado terminal (finalizada|abandonada): fecha_finalizacion = current_date, estado_id resuelto por slug, motivo_cierre opcional (vacío/whitespace -> NULL). Acceso: is_admin() or has_active_assignment(p_paciente_id) — DEC-31 (medir-chakras): terapeuta_id de la etapa ya NO autoriza, solo procedencia. DEC-33: exige cerrar_etapa_con_medicion (medicion_cierre_requerida, P0001) cuando p_estado=finalizada, la etapa arrancó y el caller tiene asignación activa; el cierre administrativo sin asignación y el de una etapa sin arrancar no exigen medición. Genera cierre_automatico (_generar_cierre_automatico) antes de cerrar, cuando corresponde.';

-- ---------------------------------------------------------------------------
-- 6. baja_voluntaria_paciente — cierre_automatico hook (R5: for loop, no limit 1)
-- ---------------------------------------------------------------------------
-- 🔴 CRÍTICO — ver el header de este archivo y design §2.4. El body de esta
-- función NO valida ownership; su ÚNICA defensa anti-IDOR son los revokes
-- que la siguen abajo, que este `create or replace` acaba de anular (el
-- default privilege del proyecto re-otorga EXECUTE a `authenticated`). M5
-- (20260920210400_mediciones_grants.sql) los restaura y DEBE correr en el
-- MISMO `db push` que esta migración.

create or replace function public.baja_voluntaria_paciente(p_user_id uuid)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_estado_baja        uuid;
  v_estado_abandonada  uuid;
  v_paciente_id        uuid;
  v_etapa_id           uuid;
begin
  if p_user_id is null then
    raise exception 'no_autorizado'
      using errcode = '42501',
            detail  = 'p_user_id es obligatorio';
  end if;

  select id into v_estado_baja
    from public.estados_paciente
   where codigo = 'baja_voluntaria';

  if v_estado_baja is null then
    raise exception 'estado_baja_voluntaria_no_encontrado'
      using errcode = 'P0002',
            detail  = 'Falta la fila baja_voluntaria en estados_paciente';
  end if;

  select id into v_estado_abandonada
    from public.estados_etapa
   where codigo = 'abandonada';

  if v_estado_abandonada is null then
    raise exception 'estado_etapa_abandonada_no_encontrado'
      using errcode = 'P0002',
            detail  = 'Falta la fila abandonada en estados_etapa';
  end if;

  select id into v_paciente_id
    from public.pacientes
   where user_id = p_user_id
     for update;

  if v_paciente_id is null then
    if public.is_admin(p_user_id)
       or exists (select 1 from public.terapeutas where id = p_user_id) then
      raise exception 'no_autorizado'
        using errcode = '42501',
              detail  = 'La baja voluntaria es solo para cuentas de paciente';
    end if;

    return jsonb_build_object('status', 'ya_dado_de_baja', 'pacienteId', null);
  end if;

  update public.pacientes
     set estado_id            = v_estado_baja,
         activo               = false,
         fecha_cambio_estado  = now(),
         motivo_cambio_estado = 'Baja voluntaria solicitada por el paciente desde la app',
         user_id              = null
   where id = v_paciente_id;

  update public.asignaciones_paciente
     set fecha_hasta = current_date,
         motivo      = 'Cierre por baja voluntaria del paciente'
   where paciente_id = v_paciente_id
     and fecha_hasta is null;

  -- 5.5. Cierre automático de la lectura de estructura (medir-chakras design
  --      §3.2), ANTES de cerrar la(s) etapa(s) en el paso 6. El update de
  --      abajo NO tiene limit 1 y puede tocar más de una etapa abierta si hay
  --      una anomalía de datos; este for recorre exactamente el mismo
  --      conjunto para que ninguna quede cerrada sin su copia. La asignación
  --      YA se cerró arriba y esta función corre bajo service_role
  --      (auth.uid() es null) — por eso _generar_cierre_automatico no toma
  --      NINGUNA decisión de autorización, no podría.
  for v_etapa_id in
    select et.id
      from public.etapas_tratamiento et
     where et.paciente_id = v_paciente_id
       and et.fecha_finalizacion is null
  loop
    perform public._generar_cierre_automatico(v_etapa_id);
  end loop;

  update public.etapas_tratamiento
     set estado_id          = v_estado_abandonada,
         fecha_finalizacion = current_date,
         motivo_cierre      = 'Cierre por baja voluntaria del paciente'
   where paciente_id = v_paciente_id
     and fecha_finalizacion is null;

  update public.otps_activacion
     set estado = 'superseded'
   where paciente_id = v_paciente_id
     and estado      = 'active';

  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores)
  values (
    'pacientes',
    v_paciente_id::text,
    'baja_voluntaria',
    null,
    jsonb_build_object('user_id', p_user_id)
  );

  return jsonb_build_object('status', 'ok', 'pacienteId', v_paciente_id);
end;
$$;

comment on function public.baja_voluntaria_paciente(uuid) is
  'Baja voluntaria de la cuenta de un paciente: desvincula user_id, marca la ficha como baja_voluntaria, genera cierre_automatico de estructura (medir-chakras) para cada etapa abierta con mediciones previas, cierra asignación y etapa(s) activas, supersede el OTP vigente y audita. Devuelve jsonb {status: ok|ya_dado_de_baja, pacienteId}. Idempotente a propósito: la reentrada es el camino de recuperación si auth.admin.deleteUser falla. NO borra auth.users — eso lo hace la Edge Function paciente-cuenta inmediatamente después. Levanta no_autorizado (42501) si p_user_id es null o pertenece a un terapeuta/admin. Acceso: service_role.';
