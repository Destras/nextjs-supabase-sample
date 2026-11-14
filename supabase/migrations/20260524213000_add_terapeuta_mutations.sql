-- Migration: add_terapeuta_mutations
-- Adds three RPCs: update_terapeuta, deactivate_terapeuta, reactivate_terapeuta.

-- ---------------------------------------------------------------------------
-- update_terapeuta
-- ---------------------------------------------------------------------------

create or replace function public.update_terapeuta(
  p_terapeuta_id uuid,
  p_nombre       text,
  p_telefono     text
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
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'nombre_vacio' using errcode = '23514';
  end if;

  update public.profiles   set nombre   = btrim(p_nombre) where id = p_terapeuta_id;
  update public.terapeutas set telefono = p_telefono      where id = p_terapeuta_id;

  return query select * from public.get_terapeuta(p_terapeuta_id);
end;
$$;

comment on function public.update_terapeuta(uuid, text, text) is
  'Actualiza nombre (en profiles) y teléfono de un terapeuta. Valida is_admin() y que nombre no esté vacío. No toca el email.';

grant execute on function public.update_terapeuta(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- deactivate_terapeuta
-- ---------------------------------------------------------------------------

create or replace function public.deactivate_terapeuta(
  p_terapeuta_id uuid,
  p_motivo       text
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
  v_caller_id          uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  if p_terapeuta_id = v_caller_id then
    raise exception 'no_puede_autodesactivarse' using errcode = 'P0001';
  end if;

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
    v_caller_id,
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

comment on function public.deactivate_terapeuta(uuid, text) is
  'Desactiva un terapeuta: valida is_admin(), que no se autodesactive, motivo no vacío y 0 pacientes activos. Inserta en audit_log y actualiza terapeutas. Solo service_role.';

revoke execute on function public.deactivate_terapeuta(uuid, text) from public, authenticated;
grant  execute on function public.deactivate_terapeuta(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- reactivate_terapeuta
-- ---------------------------------------------------------------------------

create or replace function public.reactivate_terapeuta(p_terapeuta_id uuid)
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
  v_caller_id        uuid := auth.uid();
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
    v_caller_id,
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

comment on function public.reactivate_terapeuta(uuid) is
  'Reactiva un terapeuta: valida is_admin(), inserta en audit_log y actualiza terapeutas a estado activo. Solo service_role.';

revoke execute on function public.reactivate_terapeuta(uuid) from public, authenticated;
grant  execute on function public.reactivate_terapeuta(uuid) to service_role;
