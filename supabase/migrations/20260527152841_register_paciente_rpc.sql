-- register_paciente: RPC atómica para crear un paciente completo.
--
-- Nota: la sección de grant execute se agrega manualmente aquí porque
-- db diff no captura EXECUTE grants (caveat conocido de migra).
--
-- La función hace:
--   1 insert en pacientes
--   1 insert en asignaciones_paciente
--   1 insert en etapas_tratamiento
--   N inserts en niveles (1..cantidad_niveles de la modalidad)
--   M inserts en etapa_bloqueos (uno por elemento de p_bloqueo_ids)
--   K inserts en etapa_alfabetos (uno por elemento de p_alfabeto_ids)
-- Todo dentro de una transacción implícita → atómica.

set check_function_bodies = off;

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

  if not (public.is_admin() or auth.uid() = v_terapeuta_id) then
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
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, fecha_alta)
  values (
    btrim(p_nombre),
    p_fecha_nacimiento,
    nullif(btrim(coalesce(p_email, '')), ''),
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
  --     fecha_seguimiento_esperada = null: se agenda cuando el nivel inicia.
  insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
  select v_etapa_id, g.n, null
    from generate_series(1, v_cantidad_niveles) as g(n);

  -- 5. Devolver el id del paciente creado.
  return v_paciente_id;
end;
$$;

comment on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], uuid[], uuid) is
  'Crea paciente + asignación + etapa + niveles + bloqueos + alfabetos en una transacción atómica. Acceso: el propio terapeuta (auth.uid()) o un admin que pase p_terapeuta_id. Devuelve el uuid del paciente creado.';

-- grant execute: db diff no captura EXECUTE grants, se agrega manualmente.
grant execute on function public.register_paciente(text, date, text, text, uuid, uuid, uuid, uuid[], uuid[], uuid) to authenticated;
