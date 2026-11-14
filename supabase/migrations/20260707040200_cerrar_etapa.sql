-- ---------------------------------------------------------------------------
-- cerrar_etapa
-- ---------------------------------------------------------------------------
-- Cierra la etapa de tratamiento ACTIVA de un paciente con un estado terminal
-- ('finalizada' o 'abandonada'). El terapeuta decide cuándo cerrar: no hay
-- gate de progreso, haya llegado o no el paciente al último nivel (confirmado
-- en el grill de producto).
--
-- Authz: el terapeuta dueño de la etapa activa (etapas_tratamiento.terapeuta_id)
-- o un admin — mismo guard NULL-safe que update_etapa_diagnostico.
--
-- p_motivo es opcional (DEC-11): si viene vacío/whitespace se guarda NULL, NO
-- un texto default (un default como "Reinicio de tratamiento" sería falso
-- cuando el estado es 'abandonada').
--
-- current_date se establece server-side para evitar drift de timezone con el
-- cliente, igual que register_paciente.
--
-- NO se toca estados_paciente: cerrar una etapa no da de baja al paciente
-- (DEC-12, fuera de alcance de esta RPC).
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
  v_terapeuta_id uuid;
  v_estado_id    uuid;
begin
  -- 1. Resolver la etapa activa (fecha_finalizacion IS NULL = en curso).
  -- order by + limit 1 para ser determinístico: si por una anomalía de datos
  -- hubiera más de una etapa sin fecha_finalizacion, tomamos la más reciente
  -- en lugar de una fila arbitraria (no hay índice único que lo garantice).
  select et.id, et.terapeuta_id
    into v_etapa_id, v_terapeuta_id
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
  -- Comparación NULL-safe: si v_terapeuta_id no resuelve, `auth.uid() = NULL`
  -- daría NULL y el guard fallaría ABIERTO. El `is not null` lo cierra;
  -- is_admin() sigue permitiendo al admin aunque no haya dueño resuelto.
  if not (
    public.is_admin()
    or (v_terapeuta_id is not null and auth.uid() = v_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- 3. Validar el estado terminal solicitado.
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

  -- 4. Cerrar la etapa. motivo_cierre es opcional (DEC-11): vacío/whitespace
  --    colapsa a NULL, nunca a un texto default (sería falso si p_estado es
  --    'abandonada'). fecha_finalizacion = current_date, server-side.
  update public.etapas_tratamiento
     set fecha_finalizacion = current_date,
         estado_id          = v_estado_id,
         motivo_cierre      = nullif(btrim(coalesce(p_motivo, '')), '')
   where id = v_etapa_id;
end;
$$;

comment on function public.cerrar_etapa(uuid, text, text) is
  'Cierra la etapa activa de un paciente con un estado terminal (finalizada|abandonada): fecha_finalizacion = current_date, estado_id resuelto por slug, motivo_cierre opcional (vacío/whitespace -> NULL). Acceso: terapeuta dueño de la etapa o admin. Sin gate de progreso. No toca estados_paciente.';

grant execute on function public.cerrar_etapa(uuid, text, text) to authenticated;
