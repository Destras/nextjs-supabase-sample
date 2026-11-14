-- Edición de paciente desde el detalle (feat/paciente-edit-route).
--
-- Dos RPCs SECURITY DEFINER que espejan el patrón de register_paciente:
--   - update_paciente_identidad: corrige la identidad (tabla pacientes).
--     Siempre editable, sin gate de progreso.
--   - update_etapa_diagnostico: corrige el diagnóstico/plan de la etapa activa,
--     con gate de frescura (solo si la etapa no tiene progreso). Cambiar la
--     modalidad regenera la grilla de niveles.
--
-- Migración versionada a mano porque `supabase db diff` no detecta los grants
-- de EXECUTE ni el proconfig (set search_path). Idempotente vía create or
-- replace. Sin push al remoto durante desarrollo.

-- ---------------------------------------------------------------------------
-- update_paciente_identidad
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
  update public.pacientes
     set nombre           = btrim(p_nombre),
         fecha_nacimiento = p_fecha_nacimiento,
         email            = nullif(btrim(coalesce(p_email, '')), ''),
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
begin
  -- 1. Resolver la etapa activa (fecha_finalizacion IS NULL = en curso).
  -- order by + limit 1 para ser determinístico: si por una anomalía de datos
  -- hubiera más de una etapa sin fecha_finalizacion, tomamos la más reciente
  -- en lugar de una fila arbitraria (no hay índice único que lo garantice).
  select et.id, et.terapeuta_id, et.modalidad_id
    into v_etapa_id, v_terapeuta_id, v_modalidad_anterior
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
  if v_modalidad_anterior is distinct from p_modalidad_id then
    delete from public.niveles where etapa_id = v_etapa_id;
    insert into public.niveles (etapa_id, numero_nivel, fecha_seguimiento_esperada)
    select v_etapa_id, g.n, null
      from generate_series(1, v_cantidad_niveles) as g(n);
  end if;
end;
$$;

comment on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], uuid[]) is
  'Corrige el diagnóstico/plan de la etapa activa in-place (causa, algoritmo, modalidad, bloqueos, alfabetos). Acceso: terapeuta de la etapa o admin. Gate de frescura: solo si la etapa no tiene progreso. Cambiar modalidad regenera la grilla de niveles.';

grant execute on function public.update_etapa_diagnostico(uuid, uuid, uuid, uuid, uuid[], uuid[]) to authenticated;
