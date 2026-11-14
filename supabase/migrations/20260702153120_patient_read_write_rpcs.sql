-- ============================================================================
-- patientReadWrite — patient mobile read/write RPCs
-- Hand-authored migration (supabase db diff cannot replay schemas/ from
-- scratch: pre-existing ordering — 11_profiles.sql references public.is_admin()
-- which is defined later in 25_admin_functions.sql). Contents mirror the
-- declarative sources exactly:
--   1. nivel_evaluacion.score -> numeric(2,1)          (50_nivel_evaluacion.sql)
--   2. 71_rpcs_pacientes.sql  (register_paciente + update_etapa_diagnostico now
--      schedule fecha_seguimiento_esperada; other fns re-applied idempotently)
--   3. 74_rpcs_mi_paciente.sql (helper + get_mi_perfil / get_mi_tratamiento_activo
--      / get_mi_plan_semanal / get_mi_evaluacion_vigente / submit_mi_evaluacion)
-- ============================================================================

-- 1. score integer -> numeric(2,1) (preserve rows: 3 -> 3.0, 4 -> 4.0)
alter table public.nivel_evaluacion
  alter column score type numeric(2,1) using score::numeric(2,1);

-- 2. Write RPCs (register_paciente / update_etapa_diagnostico schedule dates)
-- ----------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- register_paciente
-- ---------------------------------------------------------------------------
-- Crea un paciente completo en una única transacción atómica:
--   1 fila en pacientes
--   1 fila en asignaciones_paciente (fecha_hasta NULL)
--   1 fila en etapas_tratamiento (fecha_finalizacion NULL)
--   N filas en niveles (numero_nivel 1..cantidad_niveles de la modalidad)
--   M filas en etapa_bloqueos (M = cardinality de p_bloqueo_ids)
--   K filas en etapa_alfabetos (K = cardinality de p_alfabeto_ids)
--
-- current_date se establece server-side para evitar drift de timezone
-- con el cliente (decisión F del PLAN.md).
--
-- auth.uid() se usa para asignado_por independientemente de quién sea
-- v_terapeuta_id: si un admin asigna a otro terapeuta, el admin queda
-- registrado como quien realizó la asignación.
--
-- Slugs consumidos:
--   estados_paciente.codigo = 'activo'   (seed.sql:181)
--   estados_etapa.codigo    = 'activa'   (seed.sql:185)
-- Si alguien edita el seed y cambia estos slugs, la función lanzará
-- estado_paciente_activo_no_encontrado / estado_etapa_activa_no_encontrado.
-- ---------------------------------------------------------------------------

create or replace function public.register_paciente(
  p_nombre            text,
  p_fecha_nacimiento  date,
  p_email             text,
  p_telefono          text,
  p_causa_id          uuid,
  p_algoritmo_id      uuid,
  p_modalidad_id      uuid,
  p_bloqueo_ids       uuid[],
  p_alfabeto_ids      uuid[],
  p_terapeuta_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id      uuid;
  v_estado_pac_activo uuid;
  v_estado_eta_activa uuid;
  v_cantidad_niveles  integer;
  v_paciente_id       uuid;
  v_etapa_id          uuid;
begin
  -- 1. Resolver terapeuta y validar autorización.
  --    Un terapeuta solo puede registrar pacientes para sí mismo.
  --    Un admin puede registrar para cualquier terapeuta.
  v_terapeuta_id := coalesce(p_terapeuta_id, auth.uid());

  -- Comparación NULL-safe: si v_terapeuta_id no resuelve (paciente sin
  -- asignación ni etapa activa), `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue permitiendo
  -- al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 2. Resolver ids de estado por slug (slugs verificados en seed.sql:181-187).
  select ep.id into v_estado_pac_activo
    from public.estados_paciente as ep
   where ep.codigo = 'activo';

  if not found then
    raise exception 'estado_paciente_activo_no_encontrado'
      using errcode = 'P0002';
  end if;

  select ee.id into v_estado_eta_activa
    from public.estados_etapa as ee
   where ee.codigo = 'activa';

  if not found then
    raise exception 'estado_etapa_activa_no_encontrado'
      using errcode = 'P0002';
  end if;

  -- 3. Resolver cantidad_niveles de la modalidad (pre-chequeo explícito para
  --    un error descriptivo en lugar de una violación de FK genérica).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  -- 4. Inserts en orden dentro de la transacción implícita de la función.

  -- 4a. Paciente base.
  --     Email es obligatorio (DEC-E3-2): fallar rápido antes de cualquier insert.
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_requerido' using errcode = '23502';
  end if;

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, fecha_alta)
  values (
    btrim(p_nombre),
    p_fecha_nacimiento,
    btrim(p_email),
    nullif(btrim(coalesce(p_telefono, '')), ''),
    v_estado_pac_activo,
    current_date
  )
  returning id into v_paciente_id;

  -- 4b. Asignación terapeuta-paciente (fecha_hasta NULL = activa).
  --     asignado_por = auth.uid() siempre: el caller queda auditado,
  --     incluso si es un admin asignando a otro terapeuta.
  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde, asignado_por)
  values (v_paciente_id, v_terapeuta_id, current_date, auth.uid());

  -- 4c. Etapa de tratamiento inicial (fecha_finalizacion NULL = en curso).
  insert into public.etapas_tratamiento (
    paciente_id,
    terapeuta_id,
    causa_id,
    algoritmo_id,
    modalidad_id,
    fecha_inicio,
    estado_id
  )
  values (
    v_paciente_id,
    v_terapeuta_id,
    p_causa_id,
    p_algoritmo_id,
    p_modalidad_id,
    current_date,
    v_estado_eta_activa
  )
  returning id into v_etapa_id;

  -- 4d. Bloqueos de la etapa (bulk via unnest; array vacío genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 4e. Alfabetos de la etapa (bulk via unnest; array vacío genera 0 filas).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id)
  select v_etapa_id, a_id
    from unnest(p_alfabeto_ids) as t(a_id);

  -- 4f. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     fecha_seguimiento_esperada agendada mensualmente al crear la etapa:
  --     nivel k = fecha_inicio + k meses (ancla = current_date = fecha_inicio de la etapa).
  insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
  select v_etapa_id, g.n, (current_date + (g.n * interval '1 month'))::date
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- 5. Devolver el id del paciente creado.
  return v_paciente_id;
end;
$$;

comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], uuid[], uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. Acceso: el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. Devuelve el uuid del paciente creado.';

grant execute on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], uuid[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- update_paciente_identidad
-- ---------------------------------------------------------------------------
-- Corrige in-place los datos de identidad de un paciente
-- (nombre, fecha de nacimiento, email, teléfono). Estos viven en la tabla
-- pacientes y son SIEMPRE editables: no dependen del progreso del tratamiento.
--
-- Authz: el terapeuta de la asignación activa del paciente
-- (asignaciones_paciente.fecha_hasta IS NULL) o un admin. Resolvemos el
-- terapeuta dueño desde la asignación activa porque la tabla pacientes no
-- tiene terapeuta directo.
--
-- Normalización idéntica a register_paciente: btrim del nombre, y los campos
-- opcionales se colapsan a NULL cuando quedan vacíos tras el trim.
-- ---------------------------------------------------------------------------

create or replace function public.update_paciente_identidad(
  p_paciente_id          uuid,
  p_nombre               text,
  p_fecha_nacimiento     date,
  p_email                text,
  p_telefono             text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
begin
  -- 1. Resolver el terapeuta dueño y autorizar. Preferimos la asignación
  --    activa; si no hay (hueco de datos), caemos a la etapa activa, igual que
  --    update_etapa_diagnostico, para no bloquear datos siempre editables.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  if v_terapeuta_id is null then
    select et.terapeuta_id into v_terapeuta_id
      from public.etapas_tratamiento as et
     where et.paciente_id = p_paciente_id
       and et.fecha_finalizacion is null
     order by et.fecha_inicio desc, et.created_at desc
     limit 1;
  end if;

  -- Comparación NULL-safe: si v_terapeuta_id no resuelve (paciente sin
  -- asignación ni etapa activa), `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue permitiendo
  -- al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 2. Actualizar identidad in-place (sin gate de progreso).
  --     Email es obligatorio (DEC-E3-2): fallar antes del update.
  if nullif(btrim(coalesce(p_email, '')), '') is null then
    raise exception 'email_requerido' using errcode = '23502';
  end if;

  update public.pacientes
     set nombre           = btrim(p_nombre),
         fecha_nacimiento = p_fecha_nacimiento,
         email            = btrim(p_email),
         telefono         = nullif(btrim(coalesce(p_telefono, '')), '')
   where id = p_paciente_id;

  if not found then
    raise exception 'paciente_inexistente'
      using errcode = 'P0002',
            detail  = 'p_paciente_id no coincide con ningún paciente';
  end if;
end;
$$;

comment on function public.update_paciente_identidad(uuid, text, date, text, text) is
  'Corrige la identidad de un paciente in-place. Acceso: terapeuta de la asignación activa o admin. Siempre editable (sin gate de progreso).';

grant execute on function public.update_paciente_identidad(uuid, text, date, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- update_etapa_diagnostico
-- ---------------------------------------------------------------------------
-- Corrige in-place el diagnóstico + plan de la etapa de tratamiento ACTIVA de
-- un paciente (causa, algoritmo, modalidad, bloqueos, alfabetos). Es una
-- corrección de error de carga, NO un re-diagnóstico.
--
-- Authz: el terapeuta de la etapa activa (etapas_tratamiento.terapeuta_id) o
-- un admin.
--
-- GATE DE FRESCURA (autoritativo, server-side): solo se permite corregir
-- mientras la etapa no tenga progreso. Una etapa está "fresca" si ninguno de
-- sus niveles tiene fecha_seguimiento_real y no existe ninguna evaluación
-- (nivel_evaluacion) colgando de esos niveles. Si ya arrancó, corregir el
-- diagnóstico sería un re-diagnóstico (otro flujo), no esta edición.
--
-- Cambiar la modalidad regenera la grilla de niveles (la modalidad define
-- cantidad_niveles). Es seguro precisamente porque el gate garantiza que no
-- hay progreso ni evaluaciones que destruir.
-- ---------------------------------------------------------------------------

create or replace function public.update_etapa_diagnostico(
  p_paciente_id  uuid,
  p_causa_id     uuid,
  p_algoritmo_id uuid,
  p_modalidad_id uuid,
  p_bloqueo_ids  uuid[],
  p_alfabeto_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_etapa_id           uuid;
  v_terapeuta_id       uuid;
  v_modalidad_anterior uuid;
  v_cantidad_niveles   integer;
  v_fecha_inicio       date;
begin
  -- 1. Resolver la etapa activa (fecha_finalizacion IS NULL = en curso).
  -- order by + limit 1 para ser determinístico: si por una anomalía de datos
  -- hubiera más de una etapa sin fecha_finalizacion, tomamos la más reciente
  -- en lugar de una fila arbitraria (no hay índice único que lo garantice).
  select et.id, et.terapeuta_id, et.modalidad_id, et.fecha_inicio
    into v_etapa_id, v_terapeuta_id, v_modalidad_anterior, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = p_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'etapa_activa_no_encontrada'
      using errcode = 'P0002',
            detail  = 'el paciente no tiene una etapa de tratamiento activa';
  end if;

  -- 2. Autorizar contra el terapeuta dueño de la etapa.
  -- Comparación NULL-safe: si v_terapeuta_id no resuelve (paciente sin
  -- asignación ni etapa activa), `auth.uid() = NULL` daría NULL y el guard
  -- fallaría ABIERTO. El `is not null` lo cierra; is_admin() sigue permitiendo
  -- al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Gate de frescura: bloquear si la etapa ya tiene progreso.
  if exists (
        select 1
          from public.niveles as n
         where n.etapa_id = v_etapa_id
           and n.fecha_seguimiento_real is not null
      )
     or exists (
        select 1
          from public.nivel_evaluacion as ne
          join public.niveles as n on n.id = ne.nivel_id
         where n.etapa_id = v_etapa_id
      )
     or exists (
        select 1
          from public.entregas_plan as ep
         where ep.etapa_id = v_etapa_id
           and ep.fecha_entregada is not null
      ) then
    raise exception 'etapa_con_progreso'
      using errcode = 'P0001',
            detail  = 'la etapa ya tiene progreso (niveles cursados o evaluaciones); corregir el diagnóstico requiere un re-diagnóstico, no esta edición';
  end if;

  -- 4. Pre-chequear la modalidad para un error descriptivo y obtener su
  --    cantidad_niveles (necesaria si hay que regenerar la grilla).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  -- 5. Actualizar el snapshot de diagnóstico de la etapa.
  update public.etapas_tratamiento
     set causa_id     = p_causa_id,
         algoritmo_id = p_algoritmo_id,
         modalidad_id = p_modalidad_id
   where id = v_etapa_id;

  -- 6. Reemplazar bloqueos (delete + bulk insert; array vacío/NULL = 0 filas).
  delete from public.etapa_bloqueos where etapa_id = v_etapa_id;
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 7. Reemplazar alfabetos (idéntico a bloqueos).
  delete from public.etapa_alfabetos where etapa_id = v_etapa_id;
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id)
  select v_etapa_id, a_id
    from unnest(p_alfabeto_ids) as t(a_id);

  -- 8. Regenerar niveles SOLO si cambió la modalidad. Seguro por el gate.
  --    Fechas ancladas a v_fecha_inicio (fecha real de la etapa), NO a current_date,
  --    porque la etapa ya existe y tiene su propia fecha de inicio (DEC-0-4).
  if v_modalidad_anterior is distinct from p_modalidad_id then
    delete from public.niveles where etapa_id = v_etapa_id;
    insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
    select v_etapa_id, g.n, (v_fecha_inicio + (g.n * interval '1 month'))::date
      from generate_series(1, v_cantidad_niveles) as g(n);
  end if;
end;
$$;

comment on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], uuid[]) is
  'Corrige el diagnóstico/plan de la etapa activa in-place (causa, algoritmo, modalidad, bloqueos, alfabetos). Acceso: terapeuta de la etapa o admin. Gate de frescura: solo si la etapa no tiene progreso. Cambiar modalidad regenera la grilla de niveles.';

grant execute on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- etapa_plan_completo
-- ---------------------------------------------------------------------------
-- Helper de completitud del plan de tratamiento de una etapa.
-- Espeja la regla del front (semanasDeModalidad.ts + isSemanaCompleta):
--   * Total de semanas = coalesce(cantidad_sesiones, cantidad_niveles * 4)
--   * Una semana está completa si tiene los 3 slots: orden 1 (video),
--     orden 2 (audio/mantra) y orden 3 (frase) — mismo invariante que el front.
--   * El plan está completo si todas las semanas del total están completas.
--
-- Retorna false cuando no se puede resolver la modalidad (etapa inexistente).
-- Privada: la llama set_entregas_plan (security definer); sin grant a roles externos.
-- ---------------------------------------------------------------------------

create or replace function public.etapa_plan_completo(p_etapa_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total     integer;
  v_completas integer;
begin
  -- Total de semanas = regla del front: cantidad_sesiones, fallback cantidad_niveles*4.
  select coalesce(m.cantidad_sesiones, m.cantidad_niveles * 4)
    into v_total
    from public.etapas_tratamiento as e
    join public.modalidades as m on m.id = e.modalidad_id
   where e.id = p_etapa_id;

  if v_total is null then
    return false;
  end if;

  -- Una semana (dia_offset / 7) está completa si tiene las 3 entregas:
  -- orden 1 (video), 2 (audio) y 3 (frase) — el mismo invariante de 3 slots
  -- que enforce el front (isSemanaCompleta en semanaCompleteness.ts).
  select count(*)
    into v_completas
    from (
      select ep.dia_offset / 7 as semana
        from public.entregas_plan as ep
       where ep.etapa_id = p_etapa_id
         and ep.orden in (1, 2, 3)
       group by ep.dia_offset / 7
      having count(distinct ep.orden) = 3
    ) as t;

  return v_completas = v_total;
end;
$$;

comment on function public.etapa_plan_completo(uuid) is
  'Verifica si el plan de entregas de una etapa está completo: todas las semanas (coalesce(cantidad_sesiones, cantidad_niveles*4)) tienen los 3 slots (órdenes 1, 2, 3). Espeja la regla de completitud del front. Privada: la invoca set_entregas_plan.';

-- Sin grant: privada (la llama set_entregas_plan, que corre como definer).
-- anon y authenticated no necesitan acceso directo.
revoke execute on function public.etapa_plan_completo(uuid) from public;

-- ---------------------------------------------------------------------------
-- set_entregas_plan
-- ---------------------------------------------------------------------------
-- Full-replace del plan de entregas de una etapa en una transacción atómica:
--   1. Borra todas las filas existentes de entregas_plan para la etapa.
--   2. Inserta las filas del JSONB recibido.
--   3. Si el plan quedó completo (etapa_plan_completo), dispara la generación
--      del OTP de activación del paciente (generar_otp_activacion). Idempotente:
--      si el paciente ya tiene cuenta o un OTP active vigente, no genera uno nuevo.
--
-- El JSONB debe ser un array de objetos con:
--   semana       integer  (1-based; dia_offset = (semana - 1) * 7)
--   orden        integer
--   contenido_id text     (uuid | '' | null)  -- XOR con frase_id
--   frase_id     text     (uuid | '' | null)  -- XOR con contenido_id
--
-- El CHECK entrega_contenido_xor_frase valida el XOR por fila;
-- si algún item lo viola, la transacción entera aborta.
--
-- Acceso: el terapeuta dueño de la etapa (etapas_tratamiento.terapeuta_id)
-- o un admin. Escritura exclusivamente via security definer; la RLS de
-- entregas_plan permanece select-only.
-- ---------------------------------------------------------------------------

create or replace function public.set_entregas_plan(
  p_etapa_id      uuid,
  p_entregas_plan jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id uuid;
  v_paciente_id  uuid;
begin
  -- 1. Resolver la etapa y obtener el terapeuta dueño.
  select e.terapeuta_id into v_terapeuta_id
    from public.etapas_tratamiento as e
   where e.id = p_etapa_id;

  if not found then
    raise exception 'etapa_inexistente' using errcode = 'P0002';
  end if;

  -- 2. Verificar autorización: terapeuta dueño o admin.
  if not (public.is_admin() or auth.uid() = v_terapeuta_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Full-replace: borrar entregas actuales e insertar las nuevas.
  --    Todo ocurre en la transacción implícita de la función → atómico.
  delete from public.entregas_plan
   where etapa_id = p_etapa_id;

  insert into public.entregas_plan (etapa_id, dia_offset, contenido_id, frase_id, orden)
  select
    p_etapa_id,
    ((item ->> 'semana')::int - 1) * 7,
    nullif(item ->> 'contenido_id', '')::uuid,
    nullif(item ->> 'frase_id', '')::uuid,
    (item ->> 'orden')::int
  from jsonb_array_elements(p_entregas_plan) as item;
  -- El CHECK entrega_contenido_xor_frase valida XOR por fila;
  -- un item mal formado aborta la transacción entera.

  -- 4. Si el plan quedó completo para todas las semanas (DEC-E1-2), devolver el
  --    paciente_id para que el web console dispare la emisión+entrega del OTP de
  --    activación vía la Edge Function paciente-invitacion. La emisión ya NO ocurre
  --    acá: Postgres no puede llamar a la Meta Cloud API y el plaintext del OTP debe
  --    entregarse por WhatsApp desde un boundary de Edge Function (DevSpec §9.2).
  --    La idempotencia (no duplicar OTP) la garantiza generar_otp_activacion en la EF.
  if public.etapa_plan_completo(p_etapa_id) then
    select e.paciente_id
      into v_paciente_id
      from public.etapas_tratamiento as e
     where e.id = p_etapa_id;

    return v_paciente_id;
  end if;

  return null;
end;
$$;

comment on function public.set_entregas_plan(uuid, jsonb) is
  'Full-replace del plan de entregas de una etapa: borra las filas previas e inserta las del JSONB recibido. Si el plan queda completo (todas las semanas con sus 3 slots), devuelve el paciente_id para que el web console dispare la emisión+entrega del OTP de activación (EF paciente-invitacion); en caso contrario devuelve null. Acceso: el terapeuta dueño de la etapa o un admin.';

grant execute on function public.set_entregas_plan(uuid, jsonb) to authenticated;

-- 3. Patient read/write RPCs + identity helper
-- ----------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- RPCs del paciente — seam de identidad + endpoints mobile
-- ---------------------------------------------------------------------------
-- Este archivo declara el helper privado de identidad y los 5 RPCs que expone
-- la app mobile del paciente (se agregan en Epics 1–4):
--
--   get_mi_paciente_id()          ← helper privado (esta task, 0.2)
--   get_mi_perfil()               ← Epic 1
--   get_mi_tratamiento_activo()   ← Epic 2
--   get_mi_plan_semanal()         ← Epic 3
--   get_mi_evaluacion_vigente()   ← Epic 4
--   submit_mi_evaluacion()        ← Epic 4
--
-- Todos los RPCs son security definer + set search_path = '' (DEC-0-2).
-- El helper no recibe parámetros de identidad: resuelve auth.uid() internamente
-- para que sea imposible que un paciente pida datos de otro (DEC-0-1).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- get_mi_paciente_id
-- ---------------------------------------------------------------------------
-- Resuelve auth.uid() → id del paciente vinculado.
-- Si el caller no tiene un paciente asociado, lanza 'no_vinculado' (P0001).
--
-- security definer: corre como owner (postgres) porque public.pacientes tiene
-- RLS terapeuta-only; el paciente no puede hacer select de su propia fila.
-- stable: no modifica datos; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
--
-- Privada: sin grant a authenticated. Los RPCs get_mi_*/submit_mi_evaluacion
-- son security definer (corren como owner) y pueden invocar este helper;
-- el paciente nunca puede llamarlo directamente (DEC-0-2).
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_paciente_id()
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
begin
  select id
    into v_paciente_id
    from public.pacientes
   where user_id = auth.uid();

  if not found or v_paciente_id is null then
    raise exception 'no_vinculado' using errcode = 'P0001';
  end if;

  return v_paciente_id;
end;
$$;

comment on function public.get_mi_paciente_id() is
  'Resuelve auth.uid() al id del paciente vinculado en public.pacientes. '
  'Lanza no_vinculado (P0001) si el caller no tiene paciente asociado. '
  'Privada (sin grant a authenticated): la invocan los RPCs get_mi_*/submit_mi_evaluacion, '
  'que corren como security definer y tienen acceso como owner.';

-- Sin grant: privada (la llaman los RPCs de paciente, que corren como definer).
-- anon y authenticated no necesitan —ni deben tener— acceso directo.
revoke execute on function public.get_mi_paciente_id() from public;

-- ---------------------------------------------------------------------------
-- get_mi_perfil
-- ---------------------------------------------------------------------------
-- Devuelve la proyección segura del perfil del paciente caller.
-- Resuelve la identidad vía get_mi_paciente_id() y arma un jsonb con los 9
-- campos de contacto visibles al paciente: nombre, telefono, email,
-- contactoAlternativo, relacionContacto, fechaNacimiento, fechaAlta, edad
-- (derivada de fecha_nacimiento) y estado (derivado de estados_paciente.codigo).
--
-- security definer: corre como owner porque public.pacientes tiene RLS
-- terapeuta-only; el paciente no puede hacer select de su propia fila.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_perfil()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_result      jsonb;
begin
  v_paciente_id := public.get_mi_paciente_id();

  select jsonb_build_object(
    'nombre',              p.nombre,
    'telefono',            p.telefono,
    'email',               p.email,
    'contactoAlternativo', p.contacto_alternativo,
    'relacionContacto',    p.relacion_contacto,
    'fechaNacimiento',     p.fecha_nacimiento,
    'fechaAlta',           p.fecha_alta,
    'edad',                case when p.fecha_nacimiento is null then null
                                else extract(year from age(p.fecha_nacimiento))::int end,
    'estado',              ep.codigo
  )
  into v_result
  from public.pacientes as p
  left join public.estados_paciente as ep on ep.id = p.estado_id
  where p.id = v_paciente_id;

  return v_result;
end;
$$;

grant execute on function public.get_mi_perfil() to authenticated;

comment on function public.get_mi_perfil() is
  'Devuelve la proyección segura del perfil del paciente caller resuelto por auth.uid(). '
  'Retorna un jsonb con 9 claves camelCase (nombre, telefono, email, contactoAlternativo, '
  'relacionContacto, fechaNacimiento, fechaAlta, edad, estado). '
  'edad se deriva de fecha_nacimiento (años completos, null si ausente). '
  'estado se deriva de estados_paciente.codigo (activo/pausado, null si sin estado). '
  'Lanza no_vinculado (P0001) si el caller no tiene paciente vinculado.';

-- ---------------------------------------------------------------------------
-- get_mi_tratamiento_activo
-- ---------------------------------------------------------------------------
-- Devuelve el resumen de progreso del tratamiento activo del paciente caller.
-- Espeja mapAsignacionToPaciente.ts línea a línea: misma cascada semanasTotales,
-- mismo criterio nivelActual, misma regla proximaEvaluacion.
--
-- Las 7 claves del contrato (D-3):
--   nivelActual         → primer nivel sin fecha_seguimiento_real (asc), o el último
--   nivelesTotales      → modalidades.cantidad_niveles
--   semanaActual        → floor((hoy - fecha_inicio)/7) + 1, capeada a semanasTotales
--   semanasTotales      → cascada: ceil((maxEsperada - inicio)/7) → cantidad_sesiones → cantidad_niveles*4
--   fechaInicio         → etapas_tratamiento.fecha_inicio
--   proximaEvaluacion   → min(fecha_seguimiento_esperada) futura, comparación estricta
--   estado              → estados_paciente.codigo del paciente (no de la etapa)
--
-- NO devuelve etapaActual/etapasTotales (número de etapa no aplica aquí).
--
-- security definer: corre como owner porque las tablas tienen RLS terapeuta-only;
--   el paciente no puede hacer select de sus propias filas.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_tratamiento_activo()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id       uuid;
  v_etapa_id          uuid;
  v_fecha_inicio      date;
  v_cantidad_niveles  int;
  v_cantidad_sesiones int;
  v_nivel_actual      int;
  v_max_esperada      date;
  v_semanas_totales   int;
  v_semana_actual     int;
  v_proxima           date;
  v_estado            text;
  v_result            jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa + modalidad (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id, et.fecha_inicio, m.cantidad_niveles, m.cantidad_sesiones
    into v_etapa_id, v_fecha_inicio, v_cantidad_niveles, v_cantidad_sesiones
    from public.etapas_tratamiento as et
    join public.modalidades as m on m.id = et.modalidad_id
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. nivelActual (espeja mapper L89-97): primer nivel sin cerrar (asc), o el
  --    último si todos cerrados. Single-pass con coalesce + aggregate filter.
  --    Sin niveles → coalesce(null, null) = null.
  select coalesce(
    min(n.numero_nivel) filter (where n.fecha_seguimiento_real is null),
    max(n.numero_nivel)
  )
    into v_nivel_actual
    from public.niveles as n
   where n.etapa_id = v_etapa_id;

  -- 4. v_max_esperada: insumo de semanasTotales (espeja lastFechaSeguimientoEsperada L101-106).
  --    max() ignora nulls de forma nativa.
  select max(n.fecha_seguimiento_esperada)
    into v_max_esperada
    from public.niveles as n
   where n.etapa_id = v_etapa_id;

  -- 5. semanasTotales (espeja mapper L117-132, cuidado PAC-005).
  --    Rama agendada: ceil((max_esperada - fecha_inicio) / 7) con greatest(1, ...).
  --    Fallback: coalesce(cantidad_sesiones, cantidad_niveles*4).
  --    NUNCA *4 a secas (eso es el bug PAC-005: daba 16 para toda modalidad con 4 niveles).
  v_semanas_totales := case
    when v_max_esperada is not null
      then greatest(1, ceil((v_max_esperada - v_fecha_inicio)::numeric / 7))::int
    else coalesce(v_cantidad_sesiones, v_cantidad_niveles * 4)
  end;

  -- 6. semanaActual (espeja mapper L134-145): floor((hoy - inicio)/7) + 1,
  --    capeada arriba a semanasTotales. SIN clamp inferior (el mapper no tiene piso).
  v_semana_actual := least(
    floor((current_date - v_fecha_inicio)::numeric / 7)::int + 1,
    v_semanas_totales
  );

  -- 7. proximaEvaluacion (espeja mapper L181-188): min fecha futura, comparación
  --    estricta (> current_date excluye hoy, espejando getTime() > today.getTime()).
  --    Null si no queda ninguna fecha futura.
  select min(n.fecha_seguimiento_esperada)
    into v_proxima
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada > current_date;

  -- 8. estado: código del estado del paciente (no de la etapa).
  --    Misma fuente que get_mi_perfil; null si paciente no tiene estado asignado.
  select ep.codigo
    into v_estado
    from public.pacientes as p
    left join public.estados_paciente as ep on ep.id = p.estado_id
   where p.id = v_paciente_id;

  -- 9. Armar y devolver el jsonb con las 7 claves del contrato (D-3).
  --    NO se incluyen etapaActual/etapasTotales.
  v_result := jsonb_build_object(
    'nivelActual',       v_nivel_actual,
    'nivelesTotales',    v_cantidad_niveles,
    'semanaActual',      v_semana_actual,
    'semanasTotales',    v_semanas_totales,
    'fechaInicio',       v_fecha_inicio,
    'proximaEvaluacion', v_proxima,
    'estado',            v_estado
  );
  return v_result;
end;
$$;

grant execute on function public.get_mi_tratamiento_activo() to authenticated;

comment on function public.get_mi_tratamiento_activo() is
  'Devuelve el resumen de progreso del tratamiento activo del paciente caller. '
  'Espeja mapAsignacionToPaciente.ts: nivelActual (primer nivel sin cerrar asc, o el último si todos completos), '
  'semanasTotales (cascada: ceil((maxEsperada-inicio)/7) → cantidad_sesiones → cantidad_niveles*4), '
  'semanaActual (floor((hoy-inicio)/7)+1 capeada a semanasTotales, sin piso), '
  'proximaEvaluacion (min fecha_seguimiento_esperada > current_date, comparación estricta). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa; no_vinculado (P0001) si no hay vínculo. '
  'NO devuelve etapaActual/etapasTotales.';

-- ---------------------------------------------------------------------------
-- get_mi_plan_semanal
-- ---------------------------------------------------------------------------
-- Devuelve el plan de tratamiento semanal completo del paciente caller.
-- Lee las entregas_plan de la etapa activa + joins a contenidos y
-- frases_motivacionales, deriva semana, fechaDesbloqueo y estadoSemana,
-- y devuelve el array de semanas con sus piezas y frase motivacional.
--
-- Contrato de respuesta (array jsonb):
--   [{ semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo,
--      descripcion, recursoRef, duracion }], frase }]
--
-- Nulling de futuras (DEC-3-2): para estadoSemana = 'futura', recursoRef por
-- pieza y frase de la semana viajan como null. El resto de los campos de la
-- pieza (id/tipo/titulo/descripcion/duracion) siempre viajan → la app muestra
-- un teaser bloqueado pero el path del bucket nunca sale del server.
--
-- recursoRef (DEC-3-3): es el path del objeto en el bucket (contenidos.recurso_ref),
-- NO una URL firmada. El mobile firma client-side con storage.createSignedUrl.
--
-- estadoSemana (DEC-3-1): ventana semiabierta [fechaDesbloqueo, fechaDesbloqueo+7).
--   futura   → current_date < fechaDesbloqueo
--   actual   → fechaDesbloqueo <= current_date < fechaDesbloqueo + 7
--   anterior → current_date >= fechaDesbloqueo + 7
-- Las ventanas tilean exactamente (dia_offset = (semana-1)*7) → una sola actual.
--
-- security definer: corre como owner porque las tablas tienen RLS terapeuta-only;
--   el paciente no puede hacer select de sus propias filas.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_plan_semanal()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
  v_fecha_inicio date;
  v_result      jsonb;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa (gate sin_etapa_activa).
  --    No se necesita la modalidad: las semanas salen de las entregas_plan realmente
  --    cargadas (el plan se autoriza completo antes de generar el OTP).
  select et.id, et.fecha_inicio
    into v_etapa_id, v_fecha_inicio
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Armar el array de semanas en un único query con CTEs (DEC-3-1…DEC-3-4).
  --    Una fila de salida por SEMANA (no por entrega): fechaDesbloqueo es el
  --    inicio de la semana (fecha_inicio + (semana-1)*7), robusto a entregas en
  --    días distintos dentro de la misma semana (evita semanas duplicadas).
  with base as (
    -- Una fila por entrega_plan: deriva semana y los campos de contenido/frase.
    select
      floor(ep.dia_offset / 7)::int + 1 as semana,
      ep.orden,
      ep.dia_offset,
      ep.contenido_id,
      ep.frase_id,
      c.id           as pieza_id,
      c.tipo         as pieza_tipo,
      c.titulo       as pieza_titulo,
      c.descripcion  as pieza_descripcion,
      c.recurso_ref  as pieza_recurso_ref,
      c.duracion_seg as pieza_duracion,
      f.texto        as frase_texto
    from public.entregas_plan as ep
    left join public.contenidos as c             on c.id = ep.contenido_id
    left join public.frases_motivacionales as f  on f.id = ep.frase_id
    where ep.etapa_id = v_etapa_id
  ),
  semanas as (
    -- Una fila por semana distinta; fecha_desbloqueo = inicio de la semana.
    select
      b.semana,
      (v_fecha_inicio + (b.semana - 1) * 7)::date as fecha_desbloqueo
    from base as b
    group by b.semana
  ),
  marcadas as (
    -- estadoSemana por semana. Ventana semiabierta [desbloqueo, desbloqueo+7).
    select
      s.semana,
      s.fecha_desbloqueo,
      case
        when current_date <  s.fecha_desbloqueo     then 'futura'
        when current_date >= s.fecha_desbloqueo + 7 then 'anterior'
        else 'actual'
      end as estado_semana
    from semanas as s
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'semana',          m.semana,
      'estadoSemana',    m.estado_semana,
      'fechaDesbloqueo', m.fecha_desbloqueo,
      -- piezas: filas de media (contenido_id not null) de la semana, ordenadas
      -- por (orden, dia_offset). recursoRef nuleado server-side para futuras.
      -- Semana sin media devuelve piezas: [] (coalesce).
      'piezas', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',          b.pieza_id,
            'tipo',        b.pieza_tipo,
            'titulo',      b.pieza_titulo,
            'descripcion', b.pieza_descripcion,
            'recursoRef',  case when m.estado_semana = 'futura' then null else b.pieza_recurso_ref end,
            'duracion',    b.pieza_duracion
          )
          order by b.orden, b.dia_offset
        )
        from base as b
        where b.semana = m.semana
          and b.contenido_id is not null
      ), '[]'::jsonb),
      -- frase: texto plano de la única frase de la semana (no un objeto).
      -- Nuleada server-side para semanas futuras (DEC-3-2).
      'frase', case
        when m.estado_semana = 'futura' then null
        else (
          select max(b.frase_texto)
          from base as b
          where b.semana = m.semana
            and b.frase_id is not null
        )
      end
    )
    order by m.semana
  ), '[]'::jsonb)
  into v_result
  from marcadas as m;

  return v_result;
end;
$$;

grant execute on function public.get_mi_plan_semanal() to authenticated;

comment on function public.get_mi_plan_semanal() is
  'Devuelve el plan de tratamiento semanal del paciente caller como array jsonb. '
  'Cada elemento: { semana, estadoSemana, fechaDesbloqueo, piezas: [{ id, tipo, titulo, descripcion, recursoRef, duracion }], frase }. '
  'semana = floor(dia_offset/7)+1; fechaDesbloqueo = fecha_inicio + dia_offset. '
  'estadoSemana: futura (hoy < desbloqueo), actual ([desbloqueo, desbloqueo+7)), anterior (hoy >= desbloqueo+7). '
  'Nulling de futuras: recursoRef por pieza y frase = null cuando estadoSemana = futura. '
  'recursoRef es el path del bucket (contenidos.recurso_ref), NO URL firmada — el mobile firma client-side. '
  'Etapa sin entregas → []. Lanza sin_etapa_activa (P0001) si no hay etapa activa; no_vinculado (P0001) si no hay vínculo.';

-- ---------------------------------------------------------------------------
-- get_mi_evaluacion_vigente
-- ---------------------------------------------------------------------------
-- Determina el nivel vigente del paciente caller: el menor numero_nivel cuya
-- fecha_seguimiento_esperada <= current_date y que no tiene fila en
-- nivel_evaluacion. Para ese nivel, arma las 2 frases esperadas (causa y
-- algoritmo) con mapeo 1:1 numero_etapa = numero_nivel.
--
-- Contrato de respuesta:
--   { vigente: false }                                ← sin nivel pendiente
--   { vigente: true, nivelId, resultadoEsperado: {   ← nivel pendiente
--       causa: text | null,
--       algoritmo: text | null } }
--
-- Mapeo 1:1 (DEC-4-2, §9.3 #2): numero_etapa = numero_nivel directo.
-- causa_etapas / algoritmo_etapas tienen numero_etapa 1..4 (una entrada por
-- nivel en toda modalidad de 4 niveles). Frase null si falta la fila de
-- catálogo — no se interrumpe la pantalla de evaluación.
--
-- Fechas null legacy (< Epic 0): la comparación <= current_date es false para
-- null → esos niveles nunca son vigentes (sin manejo explícito).
--
-- security definer: corre como owner porque las tablas tienen RLS terapeuta-only;
--   el paciente no puede hacer select de sus propias filas.
-- stable: solo lectura; seguro para caching intra-statement.
-- set search_path = '': todas las referencias deben ser schema-cualificadas.
-- ---------------------------------------------------------------------------

create or replace function public.get_mi_evaluacion_vigente()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_paciente_id     uuid;
  v_etapa_id        uuid;
  v_causa_id        uuid;
  v_algoritmo_id    uuid;
  v_nivel_id        uuid;
  v_numero_nivel    int;
  v_causa_frase     text;
  v_algoritmo_frase text;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa + causa_id/algoritmo_id (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id, et.causa_id, et.algoritmo_id
    into v_etapa_id, v_causa_id, v_algoritmo_id
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Determinar el nivel vigente: menor numero_nivel vencido sin responder.
  --    <= current_date excluye nulls legacy (la comparación con null es false).
  --    not exists sobre nivel_evaluacion garantiza que el nivel no fue respondido.
  --    order by numero_nivel asc limit 1: si hay varios vencidos, el menor primero.
  select n.id, n.numero_nivel
    into v_nivel_id, v_numero_nivel
    from public.niveles as n
   where n.etapa_id = v_etapa_id
     and n.fecha_seguimiento_esperada <= current_date
     and not exists (
       select 1 from public.nivel_evaluacion as ne where ne.nivel_id = n.id
     )
   order by n.numero_nivel asc
   limit 1;

  if not found then
    return jsonb_build_object('vigente', false);
  end if;

  -- 4. Armar resultadoEsperado con mapeo 1:1 numero_etapa = numero_nivel.
  --    Si falta la fila de catálogo, la frase queda null (sin raise) — una
  --    fila faltante no debe tirar la pantalla de evaluación.
  select ce.frase_esperada
    into v_causa_frase
    from public.causa_etapas as ce
   where ce.causa_id = v_causa_id
     and ce.numero_etapa = v_numero_nivel;

  select ae.frase_esperada
    into v_algoritmo_frase
    from public.algoritmo_etapas as ae
   where ae.algoritmo_id = v_algoritmo_id
     and ae.numero_etapa = v_numero_nivel;

  return jsonb_build_object(
    'vigente',           true,
    'nivelId',           v_nivel_id,
    'resultadoEsperado', jsonb_build_object(
      'causa',     v_causa_frase,
      'algoritmo', v_algoritmo_frase
    )
  );
end;
$$;

grant execute on function public.get_mi_evaluacion_vigente() to authenticated;

comment on function public.get_mi_evaluacion_vigente() is
  'Determina el nivel vigente del paciente caller: el menor numero_nivel con '
  'fecha_seguimiento_esperada <= current_date y sin fila en nivel_evaluacion. '
  'Para ese nivel, arma las 2 frases esperadas con mapeo 1:1 numero_etapa = numero_nivel '
  'desde causa_etapas (causa_id de la etapa) y algoritmo_etapas (algoritmo_id de la etapa). '
  'Devuelve { vigente: false } si no hay nivel pendiente; '
  '{ vigente: true, nivelId, resultadoEsperado: { causa, algoritmo } } si hay uno. '
  'Frases null si falta la fila de catálogo (no interrumpe la pantalla de evaluación). '
  'Lanza sin_etapa_activa (P0001) si no hay etapa activa; no_vinculado (P0001) si no hay vínculo.';

-- ---------------------------------------------------------------------------
-- submit_mi_evaluacion
-- ---------------------------------------------------------------------------
-- Único RPC de escritura del feature: recibe los 2 scores del paciente (causa
-- y algoritmo, 1..5 cada uno), valida pertenencia del nivel a la etapa activa
-- del caller (anti-IDOR), y persiste el promedio (causa+algoritmo)/2.0 como
-- único score en nivel_evaluacion de forma atómica e idempotente.
--
-- Orden de validación (DEC-4-3):
--   1. get_mi_paciente_id()                       → no_vinculado (P0001)
--   2. etapa activa del caller                    → sin_etapa_activa (P0001)
--   3. scores 1..5                                → score_invalido (P0001)
--   4. nivel pertenece a la etapa activa          → nivel_ajeno (P0001)
--   5. insert atómico; captura unique_violation   → ya_respondida (P0001)
--   6. return { ok: true }
--
-- Idempotencia: apoyada en unique constraint nivel_id (50_nivel_evaluacion.sql:3).
-- Sin pre-check SELECT EXISTS (eso sería TOCTOU) — el constraint es la única
-- fuente de verdad, race-safe ante reintento offline y doble-submit concurrente.
--
-- Sin gate de vencido (DEC-4-3, §16 #1): el submit no exige
-- fecha_seguimiento_esperada <= hoy; en la práctica el mobile solo expone el
-- nivel vigente. El hardening (eval_no_vigente) está diferido.
--
-- volatile (escribe): no stable. set search_path = '': todas las referencias
-- deben ser schema-cualificadas. security definer: la RLS de nivel_evaluacion
-- es select-only terapeuta; el paciente escribe exclusivamente vía este RPC.
-- ---------------------------------------------------------------------------

create or replace function public.submit_mi_evaluacion(
  p_nivel_id        uuid,
  p_score_causa     int,
  p_score_algoritmo int
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  v_paciente_id uuid;
  v_etapa_id    uuid;
begin
  -- 1. Resolver identidad del paciente caller (lanza no_vinculado si no hay vínculo).
  v_paciente_id := public.get_mi_paciente_id();

  -- 2. Resolver la etapa activa (gate sin_etapa_activa).
  --    order by fecha_inicio desc, created_at desc + limit 1 da determinismo
  --    si por anomalía hubiera más de una etapa sin fecha_finalizacion.
  select et.id
    into v_etapa_id
    from public.etapas_tratamiento as et
   where et.paciente_id = v_paciente_id
     and et.fecha_finalizacion is null
   order by et.fecha_inicio desc, et.created_at desc
   limit 1;

  if not found then
    raise exception 'sin_etapa_activa' using errcode = 'P0001';
  end if;

  -- 3. Validar scores (input barato, antes del JOIN a niveles).
  --    Ambos deben estar en [1, 5]; un solo raise cubre los dos.
  if p_score_causa not between 1 and 5
     or p_score_algoritmo not between 1 and 5 then
    raise exception 'score_invalido' using errcode = 'P0001';
  end if;

  -- 4. Verificar pertenencia del nivel a la etapa activa del caller (anti-IDOR).
  --    Un paciente no puede evaluar el nivel de otro aunque conozca su uuid.
  if not exists (
    select 1
      from public.niveles as n
     where n.id = p_nivel_id
       and n.etapa_id = v_etapa_id
  ) then
    raise exception 'nivel_ajeno' using errcode = 'P0001';
  end if;

  -- 5. Insert atómico con idempotencia vía unique_violation.
  --    (p_score_causa + p_score_algoritmo) / 2.0: el literal 2.0 (numeric)
  --    fuerza división numérica → 3 + 4 = 7 / 2.0 = 3.5, no división entera.
  --    El unique constraint nivel_id (50_nivel_evaluacion.sql:3) garantiza
  --    exactamente una evaluación por nivel — race-safe ante doble-submit.
  begin
    insert into public.nivel_evaluacion (nivel_id, score, fecha_respuesta)
    values (
      p_nivel_id,
      (p_score_causa + p_score_algoritmo) / 2.0,
      now()
    );
  exception
    when unique_violation then
      raise exception 'ya_respondida' using errcode = 'P0001';
  end;

  -- 6. Confirmar éxito.
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.submit_mi_evaluacion(uuid, int, int) to authenticated;

comment on function public.submit_mi_evaluacion(uuid, int, int) is
  'RPC de escritura: recibe p_nivel_id + 2 scores 1..5 (causa y algoritmo), '
  'valida pertenencia del nivel a la etapa activa del caller (anti-IDOR), '
  'y persiste (causa+algoritmo)/2.0 en nivel_evaluacion de forma atómica e idempotente. '
  'Orden de validación: no_vinculado → sin_etapa_activa → score_invalido → nivel_ajeno → ya_respondida. '
  'Sin gate de vencido: el submit no exige fecha_seguimiento_esperada <= hoy (DEC-4-3, §16 #1). '
  'Devuelve { ok: true } al insertar con éxito. '
  'Lanza no_vinculado (P0001) si el caller no tiene paciente vinculado; '
  'sin_etapa_activa (P0001) si no hay etapa activa; '
  'score_invalido (P0001) si algún score está fuera de [1,5]; '
  'nivel_ajeno (P0001) si p_nivel_id no pertenece a la etapa activa del caller; '
  'ya_respondida (P0001) si el nivel ya tiene una evaluación registrada.';
