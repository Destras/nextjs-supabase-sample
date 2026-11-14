-- inicioTratamiento (Epic 1, Task 1.1): las dos RPCs que insertan en
-- etapas_tratamiento (register_paciente, iniciar_nueva_etapa) pasan a crear
-- la etapa SIN ARRANCAR: estado 'pendiente' (no 'activa'), fecha_inicio NULL,
-- niveles creados igual pero sin fecha_seguimiento_esperada (queda NULL).
-- El reloj clínico arranca recién cuando set_entregas_plan completa el plan
-- de contenido (Task 1.2), no en el alta.
--
-- `db diff` está ROTO en este ambiente (mismo bug preexistente de ordering
-- documentado en 20260712040000_inicio_tratamiento_fundacion.sql). Esta
-- migración fue hand-authored, como las ~14 que ya existen. Excepción
-- declarada a .claude/supabase-declarative-database-schema.md §3.
--
-- update_etapa_diagnostico NO se toca: ya encaja solo. Cuando cambia la
-- modalidad de una etapa sin arrancar, regenera la grilla anclada en
-- v_fecha_inicio, que ahora es NULL -> NULL + interval = NULL -> los niveles
-- quedan sin agendar -> se agendan cuando la etapa arranque (Task 1.2).
--
-- Preserva verbatim el guard de authz NULL-safe en ambas RPCs:
--   public.is_admin() or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
-- El `is not null` no es decorativo: sin él, `auth.uid() = NULL` evalúa a
-- NULL (lógica de tres valores) y el guard falla ABIERTO.

-- ---------------------------------------------------------------------------
-- register_paciente
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
  p_alfabetos         jsonb,
  p_terapeuta_id      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id         uuid;
  v_estado_pac_activo    uuid;
  v_estado_eta_pendiente uuid;
  v_cantidad_niveles     integer;
  v_paciente_id          uuid;
  v_etapa_id             uuid;
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

  -- inicioTratamiento: la etapa nace 'pendiente' (sin arrancar), no 'activa'.
  -- El slug lo garantiza el insert idempotente del schema declarativo
  -- (inicioTratamiento Epic 0, Task 0.1), no el seed.
  select ee.id into v_estado_eta_pendiente
    from public.estados_etapa as ee
   where ee.codigo = 'pendiente';

  if not found then
    raise exception 'estado_etapa_pendiente_no_encontrado'
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
  --     inicioTratamiento: fecha_inicio NULL + estado 'pendiente' — la etapa
  --     se crea SIN ARRANCAR. Arranca cuando set_entregas_plan completa el
  --     plan de contenido (Task 1.2), no en el alta.
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
    null,
    v_estado_eta_pendiente
  )
  returning id into v_etapa_id;

  -- 4d. Bloqueos de la etapa (bulk via unnest; array vacío genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 4e. Alfabetos de la etapa (bulk via jsonb_array_elements; jsonb vacío ('[]')
  --     genera 0 filas, igual que el unnest de array vacío anterior).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         nullif(item ->> 'numero', '')::int
    from jsonb_array_elements(p_alfabetos) as item;

  -- 4f. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     inicioTratamiento: la grilla de N niveles se crea igual (invariante
  --     "toda etapa tiene su grilla"), pero SIN fecha_seguimiento_esperada —
  --     la etapa todavía no arrancó, no hay fecha_inicio contra la cual
  --     anclar la agenda. Se agenda cuando la etapa arranque (Task 1.2).
  insert into public.niveles (etapa_id, numero_nivel)
  select v_etapa_id, g.n
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- 5. Devolver el id del paciente creado.
  return v_paciente_id;
end;
$$;

comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], jsonb, uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. Devuelve el uuid del paciente creado.';

-- ---------------------------------------------------------------------------
-- iniciar_nueva_etapa
-- ---------------------------------------------------------------------------

create or replace function public.iniciar_nueva_etapa(
  p_paciente_id  uuid,
  p_causa_id     uuid,
  p_algoritmo_id uuid,
  p_modalidad_id uuid,
  p_bloqueo_ids  uuid[],
  p_alfabetos    jsonb default '[]'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_terapeuta_id         uuid;
  v_estado_eta_pendiente uuid;
  v_cantidad_niveles     integer;
  v_etapa_id             uuid;
begin
  -- 1. Gate duro: no se puede abrir una etapa nueva si ya hay una activa.
  --    La anterior debe finalizarse/abandonarse (cerrar_etapa) antes.
  if exists (
        select 1
          from public.etapas_tratamiento as et
         where et.paciente_id = p_paciente_id
           and et.fecha_finalizacion is null
      ) then
    raise exception 'etapa_activa_existente'
      using errcode = 'P0001',
            detail  = 'el paciente ya tiene una etapa de tratamiento activa; cerrala antes de abrir una nueva';
  end if;

  -- 2. Resolver el terapeuta dueño desde la asignación activa (relación 1:1).
  --    Fallback a la última etapa (cualquier estado) si no hay asignación
  --    activa, igual que update_paciente_identidad.
  select ap.terapeuta_id into v_terapeuta_id
    from public.asignaciones_paciente as ap
   where ap.paciente_id = p_paciente_id
     and ap.fecha_hasta is null;

  if v_terapeuta_id is null then
    select et.terapeuta_id into v_terapeuta_id
      from public.etapas_tratamiento as et
     where et.paciente_id = p_paciente_id
     order by et.fecha_inicio desc, et.created_at desc
     limit 1;
  end if;

  -- 3. Autorizar. Comparación NULL-safe: si v_terapeuta_id no resuelve,
  --    `auth.uid() = NULL` daría NULL y el guard fallaría ABIERTO. El
  --    `is not null` lo cierra; is_admin() sigue permitiendo al admin aunque
  --    no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 4. Pre-chequear la modalidad (error descriptivo en lugar de violación de
  --    FK genérica) y resolver el estado 'pendiente' por slug. inicioTratamiento:
  --    la etapa nace 'pendiente' (sin arrancar), no 'activa'. El slug lo
  --    garantiza el insert idempotente del schema declarativo (Epic 0, Task 0.1).
  select m.cantidad_niveles into v_cantidad_niveles
    from public.modalidades as m
   where m.id = p_modalidad_id;

  if not found then
    raise exception 'modalidad_inexistente'
      using errcode = 'P0002',
            detail  = 'p_modalidad_id no coincide con ninguna modalidad';
  end if;

  select ee.id into v_estado_eta_pendiente
    from public.estados_etapa as ee
   where ee.codigo = 'pendiente';

  if not found then
    raise exception 'estado_etapa_pendiente_no_encontrado' using errcode = 'P0002';
  end if;

  -- 5. Insertar la etapa nueva. inicioTratamiento: fecha_inicio NULL + estado
  --    'pendiente' — la etapa se crea SIN ARRANCAR. Arranca cuando
  --    set_entregas_plan completa el plan de contenido (Task 1.2).
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
    p_paciente_id,
    v_terapeuta_id,
    p_causa_id,
    p_algoritmo_id,
    p_modalidad_id,
    null,
    v_estado_eta_pendiente
  )
  returning id into v_etapa_id;

  -- 5a. Bloqueos de la etapa (bulk via unnest; array vacío/NULL genera 0 filas).
  insert into public.etapa_bloqueos (etapa_id, bloqueo_id)
  select v_etapa_id, b_id
    from unnest(p_bloqueo_ids) as t(b_id);

  -- 5b. Alfabetos de la etapa (bulk via jsonb_array_elements; jsonb vacío
  --     ('[]') genera 0 filas, igual que el unnest de array vacío anterior).
  insert into public.etapa_alfabetos (etapa_id, alfabeto_id, numero)
  select v_etapa_id,
         (item ->> 'alfabeto_id')::uuid,
         nullif(item ->> 'numero', '')::int
    from jsonb_array_elements(p_alfabetos) as item;

  -- 5c. Niveles de seguimiento (numero_nivel 1..cantidad_niveles).
  --     inicioTratamiento: la grilla se crea igual (invariante "toda etapa
  --     tiene su grilla"), pero SIN fecha_seguimiento_esperada — la etapa
  --     todavía no arrancó. Se agenda cuando la etapa arranque (Task 1.2).
  insert into public.niveles (etapa_id, numero_nivel)
  select v_etapa_id, g.n
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- Sin entregas_plan (DEC-22): la etapa arranca vacía de contenido; el
  -- terapeuta lo reasigna después via set_entregas_plan.

  -- 6. Devolver el id de la etapa nueva.
  return v_etapa_id;
end;
$$;

comment on function public.iniciar_nueva_etapa(uuid, uuid, uuid, uuid, uuid[], jsonb) is
  'Abre una etapa de tratamiento nueva para un paciente existente: crea etapa + niveles + bloqueos + alfabetos, SIN entregas_plan (el terapeuta reasigna contenido después). La etapa se crea SIN ARRANCAR (fecha_inicio NULL, estado ''pendiente''); los niveles se crean igual pero sin fecha_seguimiento_esperada. Arranca cuando set_entregas_plan completa el plan de contenido. Falla con etapa_activa_existente si el paciente ya tiene una etapa abierta (cerrala primero via cerrar_etapa). p_alfabetos es un jsonb array de objetos {alfabeto_id, numero}. Acceso: el terapeuta de la asignación activa del paciente o un admin. Devuelve el uuid de la etapa creada.';
