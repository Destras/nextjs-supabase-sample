-- =============================================================================
-- seguridadPanel / SEG-007 — Un terapeuta desactivado pierde el acceso en el acto
-- =============================================================================
-- Desactivar a un terapeuta cambiaba su estado y lo baneaba en Auth. El ban
-- impide volver a entrar y renovar el token, pero el access token que ya tiene
-- sigue siendo válido hasta que vence (1 h): PostgREST y el proxy del panel
-- verifican la firma del JWT, no consultan el ban. Durante esa hora seguía
-- usando el panel.
--
-- Esta migración:
--   1. is_console_user() e is_admin() devuelven false para un usuario cuya fila
--      en public.terapeutas está en estado `inactivo`. RLS y los RPC lo frenan
--      en el acto; el proxy del panel lo expulsa cuando vence su memoria de
--      60 s. Solo `inactivo` corta: `pendiente` y una fila sin estado no cambian
--      (la invitación no se ve afectada), y un admin sin fila en terapeutas
--      tampoco. Pasan a plpgsql (en el schema declarativo cargan antes que
--      terapeutas; una función SQL valida su cuerpo al crearse). Misma firma,
--      security definer, stable, search_path y grants.
--   2. deactivate_terapeuta borra las sesiones de Auth del usuario en la misma
--      transacción (los refresh tokens caen en cascada). Resto del cuerpo,
--      firma, comment y grants (solo service_role), iguales.
--
-- reactivate_terapeuta no cambia: vuelve el estado a `activo` y la Edge
-- Function levanta el ban; el terapeuta inicia sesión de nuevo.
--
-- Escrita a mano: `supabase db diff` no funciona en este repo.
-- =============================================================================

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  -- Un usuario final solo pregunta por sí mismo (SEG-005).
  if p_user_id is distinct from auth.uid()
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    return false;
  end if;

  -- Un terapeuta desactivado no conserva permisos (SEG-007).
  if exists (
    select 1
      from public.terapeutas as t
      join public.estados_terapeuta as et on et.id = t.estado_id
     where t.id = p_user_id
       and et.codigo = 'inactivo'
  ) then
    return false;
  end if;

  return exists (
    select 1
      from public.profiles as p
      join public.roles as r on r.id = p.rol_id
     where p.id = p_user_id
       and r.codigo = 'admin'
  );
end;
$$;

comment on function public.is_admin is
  'Devuelve true si el usuario (default = auth.uid()) tiene rol "admin". Usada como guarda en RPCs admin-only. A un usuario final (JWT authenticated/anon) solo le responde sobre sí mismo: con un p_user_id ajeno devuelve false (seguridadPanel / SEG-005). service_role y las llamadas internas preguntan por cualquiera. Devuelve false si el usuario es un terapeuta en estado inactivo (seguridadPanel / SEG-007). Nunca devuelve NULL.';


create or replace function public.is_console_user(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if p_user_id is null then
    return false;
  end if;

  -- Un usuario final solo pregunta por sí mismo (SEG-005).
  if p_user_id is distinct from auth.uid()
     and coalesce(auth.role(), '') in ('authenticated', 'anon') then
    return false;
  end if;

  -- Un terapeuta desactivado deja de ser usuario de consola (SEG-007).
  if exists (
    select 1
      from public.terapeutas as t
      join public.estados_terapeuta as et on et.id = t.estado_id
     where t.id = p_user_id
       and et.codigo = 'inactivo'
  ) then
    return false;
  end if;

  return exists (
    select 1
      from public.profiles as p
      join public.roles as r on r.id = p.rol_id
     where p.id = p_user_id
       and r.codigo in ('admin', 'terapeuta')
  );
end;
$$;

comment on function public.is_console_user is
  'Devuelve true si el usuario (default = auth.uid()) tiene rol "admin" o "terapeuta" — es decir, es un usuario de consola, no un paciente. rol_id null (pacientes) devuelve false. Usada en las policies de lectura de la biblioteca y del catálogo clínico (seguridadPanel / SEG-001), en la de contenido_imagenes y en el proxy del panel. A un usuario final (JWT authenticated/anon) solo le responde sobre sí mismo: con un p_user_id ajeno devuelve false (seguridadPanel / SEG-005). Devuelve false si el usuario es un terapeuta en estado inactivo (seguridadPanel / SEG-007). Nunca devuelve NULL.';

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

  -- Cerrarle las sesiones (seguridadPanel / SEG-007). La Edge Function lo banea
  -- en Auth después de este RPC, pero el ban no revoca nada: borrar las
  -- sesiones (los refresh tokens caen en cascada) deja inservible lo que tenga
  -- abierto en cualquier dispositivo. Va en la misma transacción que el cambio
  -- de estado. El access token ya emitido sigue firmado hasta que vence; lo que
  -- lo deja sin efecto es que is_console_user() / is_admin() ya dan false.
  -- Si el dueño de la función no pudiera borrar en auth.sessions, la
  -- desactivación NO debe fallar por eso: el estado y el ban ya cortan.
  begin
    delete from auth.sessions as s
     where s.user_id = p_terapeuta_id;
  exception
    when insufficient_privilege then
      raise warning 'deactivate_terapeuta: sin permiso para borrar auth.sessions de %', p_terapeuta_id;
  end;

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
  'Desactiva un terapeuta: valida is_admin(), motivo no vacío y 0 pacientes activos; deja el estado en inactivo —con eso is_console_user()/is_admin() ya le dan false— y borra sus sesiones de Auth (seguridadPanel / SEG-007). La guard de auto-desactivación la realiza la Edge Function antes de invocar. Usa p_caller_id para audit_log (auth.uid() devuelve null con service-role). Solo service_role.';

