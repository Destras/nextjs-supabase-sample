-- Migration: fix `column "id" is ambiguous` (42702) in the 3 terapeuta
-- mutation RPCs (update_terapeuta, deactivate_terapeuta, reactivate_terapeuta)
-- plus a follow-on regression: deactivate_terapeuta / reactivate_terapeuta
-- called `is_admin()` without arguments, which defaults `p_user_id` to
-- `auth.uid()`. When the Edge Function invokes via service-role, auth.uid()
-- is null, so is_admin() returns false → `no_autorizado` → wrapped by the
-- Edge Function as `deactivate_failed` / `reactivate_failed` (500).
--
-- Root cause (42702): each RPC declares `returns table(id uuid, ...)` so
-- PL/pgSQL treats `id` (and `nombre`, `email`, ...) as variables in scope
-- across the whole function body. Any unqualified reference to a column
-- named `id` (`update public.profiles set ... where id = ...`,
-- `select id into ...`, `select * from public.get_terapeuta(...)`, etc.)
-- collides with that variable and Postgres raises 42702.
--
-- Fix:
--   (a) qualify every column reference inside the bodies with a table alias
--       (pr/te/et/gt) so Postgres never has to guess; and
--   (b) pass `p_caller_id` to `is_admin()` in the two service-role RPCs so
--       authorization checks the actual admin invoking the action.
--
-- Reflected in supabase/schemas/70_rpcs_terapeutas.sql.

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

  update public.profiles   as pr set nombre   = btrim(p_nombre) where pr.id = p_terapeuta_id;
  update public.terapeutas as te set telefono = p_telefono      where te.id = p_terapeuta_id;

  return query
    select gt.id, gt.nombre, gt.email, gt.telefono, gt.estado, gt.pacientes_activos
      from public.get_terapeuta(p_terapeuta_id) gt;
end;
$$;

comment on function public.update_terapeuta(uuid, text, text) is
  'Actualiza nombre (en profiles) y teléfono de un terapeuta. Valida is_admin() y que nombre no esté vacío. No toca el email.';

grant execute on function public.update_terapeuta(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------

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
  if not public.is_admin(p_caller_id) then
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

  select et.id into v_estado_inactivo_id
    from public.estados_terapeuta as et where et.codigo = 'inactivo';

  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores, datos_nuevos)
  values (
    'terapeutas',
    p_terapeuta_id::text,
    'deactivate',
    p_caller_id,
    jsonb_build_object('estado', 'activo', 'activo', true),
    jsonb_build_object('estado', 'inactivo', 'activo', false, 'motivo', p_motivo)
  );

  update public.terapeutas as te
     set estado_id            = v_estado_inactivo_id,
         activo               = false,
         fecha_cambio_estado  = now(),
         motivo_cambio_estado = btrim(p_motivo)
   where te.id = p_terapeuta_id;

  -- Inline equivalent of get_terapeuta() — calling get_terapeuta from here
  -- would re-trigger is_admin(auth.uid()) which is null under service-role.
  return query
    select t.id,
           coalesce(pr.nombre, '')                                                 as nombre,
           coalesce(u.email::text, '')                                             as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                          as estado,
           coalesce(count(ap.*) filter (where ap.fecha_hasta is null), 0)::int     as pacientes_activos
      from public.terapeutas               t
      left join public.profiles            pr on pr.id = t.id
      left join auth.users                 u  on u.id  = t.id
      left join public.estados_terapeuta   e  on e.id  = t.estado_id
      left join public.asignaciones_paciente ap on ap.terapeuta_id = t.id
     where t.id = p_terapeuta_id
     group by t.id, pr.nombre, u.email, t.telefono, e.codigo;
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
  if not public.is_admin(p_caller_id) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  select et.id into v_estado_activo_id from public.estados_terapeuta as et where et.codigo = 'activo';

  insert into public.audit_log (tabla, registro_id, operacion, usuario_id, datos_anteriores, datos_nuevos)
  values (
    'terapeutas',
    p_terapeuta_id::text,
    'reactivate',
    p_caller_id,
    jsonb_build_object('estado', 'inactivo', 'activo', false),
    jsonb_build_object('estado', 'activo', 'activo', true)
  );

  update public.terapeutas as te
     set estado_id            = v_estado_activo_id,
         activo               = true,
         fecha_cambio_estado  = now(),
         motivo_cambio_estado = null
   where te.id = p_terapeuta_id;

  -- Inline equivalent of get_terapeuta() — calling get_terapeuta from here
  -- would re-trigger is_admin(auth.uid()) which is null under service-role.
  return query
    select t.id,
           coalesce(pr.nombre, '')                                                 as nombre,
           coalesce(u.email::text, '')                                             as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                          as estado,
           coalesce(count(ap.*) filter (where ap.fecha_hasta is null), 0)::int     as pacientes_activos
      from public.terapeutas               t
      left join public.profiles            pr on pr.id = t.id
      left join auth.users                 u  on u.id  = t.id
      left join public.estados_terapeuta   e  on e.id  = t.estado_id
      left join public.asignaciones_paciente ap on ap.terapeuta_id = t.id
     where t.id = p_terapeuta_id
     group by t.id, pr.nombre, u.email, t.telefono, e.codigo;
end;
$$;

comment on function public.reactivate_terapeuta(uuid, uuid) is
  'Reactiva un terapeuta: valida is_admin(), inserta en audit_log usando p_caller_id (auth.uid() devuelve null con service-role) y actualiza terapeutas a estado activo. Solo service_role.';

revoke execute on function public.reactivate_terapeuta(uuid, uuid) from public, authenticated;
grant  execute on function public.reactivate_terapeuta(uuid, uuid) to service_role;
