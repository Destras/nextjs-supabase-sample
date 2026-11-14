-- Migration: alter deactivate_terapeuta and reactivate_terapeuta to accept
-- p_caller_id uuid so the Edge Function can pass the JWT sub instead of
-- relying on auth.uid() (which returns null when called with service-role).
-- Also removes the self-deactivation guard from deactivate_terapeuta — that
-- guard now lives in the Edge Function before the RPC is invoked.

create or replace function public.deactivate_terapeuta(
  p_terapeuta_id uuid,
  p_motivo       text,
  p_caller_id    uuid
)
returns table(
  id                uuid,
  nombre            text,
  email             text,
  telefono          text,
  estado            text,
  pacientes_activos int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pacientes_activos  int;
  v_estado_inactivo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- Guard de auto-desactivación delegada a la Edge Function que pasa p_caller_id.

  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo_requerido' using errcode = '23514';
  end if;

  select count(*) into v_pacientes_activos
    from public.asignaciones_paciente
   where terapeuta_id = p_terapeuta_id
     and fecha_hasta is null;

  if v_pacientes_activos > 0 then
    raise exception 'tiene_pacientes_activos'
      using errcode = 'P0002',
            detail  = jsonb_build_object('count', v_pacientes_activos)::text;
  end if;

  select id into v_estado_inactivo_id
    from public.estados_terapeuta where codigo = 'inactivo';

  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores, datos_nuevos)
  values (
    'terapeutas',
    p_terapeuta_id::text,
    'deactivate',
    p_caller_id,
    jsonb_build_object('estado', 'activo', 'activo', true),
    jsonb_build_object('estado', 'inactivo', 'activo', false, 'motivo', p_motivo)
  );

  update public.terapeutas
     set estado_id            = v_estado_inactivo_id,
         activo               = false,
         fecha_cambio_estado  = now(),
         motivo_cambio_estado = btrim(p_motivo)
   where id = p_terapeuta_id;

  return query select * from public.get_terapeuta(p_terapeuta_id);
end;
$$;

comment on function public.deactivate_terapeuta(uuid, text, uuid) is
  'Desactiva un terapeuta: valida is_admin(), motivo no vacío y 0 pacientes activos. La guard de auto-desactivación la realiza la Edge Function antes de invocar. Usa p_caller_id para audit_log (auth.uid() devuelve null con service-role). Solo service_role.';

revoke execute on function public.deactivate_terapeuta(uuid, text, uuid) from public, authenticated;
grant  execute on function public.deactivate_terapeuta(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------

create or replace function public.reactivate_terapeuta(
  p_terapeuta_id uuid,
  p_caller_id    uuid
)
returns table(
  id                uuid,
  nombre            text,
  email             text,
  telefono          text,
  estado            text,
  pacientes_activos int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado_activo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select id into v_estado_activo_id from public.estados_terapeuta where codigo = 'activo';

  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores, datos_nuevos)
  values (
    'terapeutas',
    p_terapeuta_id::text,
    'reactivate',
    p_caller_id,
    jsonb_build_object('estado', 'inactivo', 'activo', false),
    jsonb_build_object('estado', 'activo', 'activo', true)
  );

  update public.terapeutas
     set estado_id            = v_estado_activo_id,
         activo               = true,
         fecha_cambio_estado  = now(),
         motivo_cambio_estado = null
   where id = p_terapeuta_id;

  return query select * from public.get_terapeuta(p_terapeuta_id);
end;
$$;

comment on function public.reactivate_terapeuta(uuid, uuid) is
  'Reactiva un terapeuta: valida is_admin(), inserta en audit_log usando p_caller_id (auth.uid() devuelve null con service-role) y actualiza terapeutas a estado activo. Solo service_role.';

revoke execute on function public.reactivate_terapeuta(uuid, uuid) from public, authenticated;
grant  execute on function public.reactivate_terapeuta(uuid, uuid) to service_role;
