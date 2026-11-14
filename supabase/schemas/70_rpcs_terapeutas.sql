create or replace function public.list_terapeutas()
returns table(
  id                uuid,
  nombre            text,
  email             text,
  telefono          text,
  estado            text,
  pacientes_activos int,
  score_promedio    numeric,
  alertas_activas   int,
  sin_iniciar       int
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  -- score_promedio: extensión aditiva del dashboard admin. "último score" de
  -- un paciente = score del nivel_evaluacion con max fecha_respuesta entre
  -- todos sus niveles (cross-etapa). NULL cuando ningún paciente activo del
  -- terapeuta tiene evaluaciones (Tier B sin data, distinto de 0). Se agrega
  -- por terapeuta en CTEs para no producir fan-out sobre el join de
  -- asignaciones. alertas_activas (D4) ya NO deriva del score: es el count
  -- del subsistema derive_alertas_activas() (65_alertas.sql) por terapeuta —
  -- siempre int no-nulo (0 filas = 0 alertas, sin caso NULL).
  --
  -- sin_iniciar (DEC-12, feat/inicio-tratamiento post-implementación):
  -- compensación de la baja del tipo de alerta contenido_pendiente — el
  -- admin supervisa la red desde acá, no desde el widget de onboarding del
  -- terapeuta (ese existe solo en su propio dashboard). Count de pacientes
  -- con asignación activa a ese terapeuta cuya etapa activa (fecha_finalizacion
  -- is null) tiene fecha_inicio is null — la misma definición canónica que
  -- fetchPacientesSinIniciar.ts (dashboard) y el filtro de derive_alertas_activas
  -- (65_alertas.sql). NO usa el código de estado de la etapa. Siempre int
  -- no-nulo (0 filas = 0, sin caso NULL).
  return query
    with paciente_score as (
      select ap.terapeuta_id,
             ap.paciente_id,
             (
               select ev.score
                 from public.nivel_evaluacion   ev
                 join public.niveles            n  on n.id  = ev.nivel_id
                 join public.etapas_tratamiento et on et.id = n.etapa_id
                where et.paciente_id = ap.paciente_id
                order by ev.fecha_respuesta desc
                limit 1
             )                                                                    as ultimo_score
        from public.asignaciones_paciente ap
       where ap.fecha_hasta is null
    ),
    alertas_por_terapeuta as (
      select d.terapeuta_id,
             count(*)::int as alertas_activas
        from public.derive_alertas_activas() d
       group by d.terapeuta_id
    ),
    sin_iniciar_por_terapeuta as (
      select ap.terapeuta_id,
             count(*)::int as sin_iniciar
        from public.asignaciones_paciente ap
        join public.etapas_tratamiento    et on et.paciente_id = ap.paciente_id
       where ap.fecha_hasta is null
         and et.fecha_finalizacion is null
         and et.fecha_inicio is null
       group by ap.terapeuta_id
    ),
    agg as (
      select ps.terapeuta_id,
             count(*)::int                                                        as pacientes_activos,
             avg(ps.ultimo_score)                                                 as score_promedio,
             coalesce(max(apt.alertas_activas), 0)                                as alertas_activas,
             coalesce(max(sip.sin_iniciar), 0)                                    as sin_iniciar
        from paciente_score ps
        left join alertas_por_terapeuta apt on apt.terapeuta_id = ps.terapeuta_id
        left join sin_iniciar_por_terapeuta sip on sip.terapeuta_id = ps.terapeuta_id
       group by ps.terapeuta_id
    )
    select t.id,
           coalesce(p.nombre, '')                                                 as nombre,
           coalesce(u.email::text, '')                                            as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                         as estado,
           coalesce(agg.pacientes_activos, 0)::int                                as pacientes_activos,
           agg.score_promedio                                                     as score_promedio,
           coalesce(agg.alertas_activas, 0)                                       as alertas_activas,
           coalesce(agg.sin_iniciar, 0)                                           as sin_iniciar
      from public.terapeutas               t
      left join public.profiles            p on p.id = t.id
      left join auth.users                 u on u.id = t.id
      left join public.estados_terapeuta   e on e.id = t.estado_id
      left join agg                          on agg.terapeuta_id = t.id;
end;
$$;

comment on function public.list_terapeutas is
  'Lista todos los terapeutas con email (de auth.users), teléfono, estado (codigo), conteo de pacientes activos y, para el dashboard admin, score_promedio (NULL si ningún paciente activo tiene evaluaciones), alertas_activas (D4: count de derive_alertas_activas() por terapeuta, siempre int no-nulo) y sin_iniciar (DEC-12: count de pacientes activos del terapeuta cuya etapa activa tiene fecha_inicio is null, siempre int no-nulo — compensación de la baja de la alerta contenido_pendiente). Guarda is_admin(). Set returning.';

grant execute on function public.list_terapeutas() to authenticated;

create or replace function public.get_terapeuta(p_terapeuta_id uuid)
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
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  return query
    select t.id,
           coalesce(p.nombre, '')                                                  as nombre,
           coalesce(u.email::text, '')                                             as email,
           t.telefono,
           coalesce(e.codigo, 'inactivo')                                          as estado,
           coalesce(
             count(ap.*) filter (where ap.fecha_hasta is null)
           , 0)::int                                                               as pacientes_activos
      from public.terapeutas               t
      left join public.profiles            p on p.id = t.id
      left join auth.users                 u on u.id = t.id
      left join public.estados_terapeuta   e on e.id = t.estado_id
      left join public.asignaciones_paciente ap on ap.terapeuta_id = t.id
     where t.id = p_terapeuta_id
     group by t.id, p.nombre, u.email, t.telefono, e.codigo;
end;
$$;

comment on function public.get_terapeuta is
  'Devuelve un terapeuta por id con email (auth.users), teléfono, estado y pacientes activos. Guarda is_admin(). Set vacío si el id no existe.';

grant execute on function public.get_terapeuta(uuid) to authenticated;

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
-- deactivate_terapeuta
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

revoke execute on function public.deactivate_terapeuta(uuid, text, uuid) from public, anon, authenticated;
grant  execute on function public.deactivate_terapeuta(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- reactivate_terapeuta
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

revoke execute on function public.reactivate_terapeuta(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.reactivate_terapeuta(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- list_pacientes_by_terapeuta
-- ---------------------------------------------------------------------------

create or replace function public.list_pacientes_by_terapeuta(p_terapeuta_id uuid)
returns table(
  asignacion_id            uuid,
  paciente_nombre          text,
  nivel_actual             int,
  ultima_evaluacion        timestamptz,
  fecha_inicio_tratamiento date
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  -- Hasta SEG-005 este guard fallaba ABIERTO sin sesión: una llamada sin login
  -- listaba los pacientes de cualquier terapeuta.
  -- Guard "admin o dueño" (seguridadPanel / SEG-008), el mismo en todos los RPC:
  --   is_admin() or (is_console_user() and <dueño> is not null and auth.uid() = <dueño>)
  -- is_console_user() es lo que deja afuera a un terapeuta desactivado con el
  -- token todavía vigente, y nunca devuelve NULL (sin sesión da false). El
  -- `is not null` cierra el otro NULL: si el dueño no resuelve,
  -- `auth.uid() = NULL` daría NULL y el guard fallaría ABIERTO.
  if not (
    public.is_admin()
    or (public.is_console_user() and p_terapeuta_id is not null and auth.uid() = p_terapeuta_id)
  ) then
    raise exception 'no_autorizado' using errcode = '42501';
  end if;

  return query
    select ap.id                                                                  as asignacion_id,
           coalesce(pa.nombre, '')                                                as paciente_nombre,
           (
             select max(n.numero_nivel)::int
               from public.niveles              n
               join public.etapas_tratamiento   e on e.id = n.etapa_id
              where e.paciente_id        = pa.id
                and e.fecha_finalizacion is null
           )                                                                      as nivel_actual,
           (
             select max(ne.fecha_respuesta)
               from public.nivel_evaluacion     ne
               join public.niveles              n on n.id = ne.nivel_id
               join public.etapas_tratamiento   e on e.id = n.etapa_id
              where e.paciente_id = pa.id
           )                                                                      as ultima_evaluacion,
           ap.fecha_desde                                                         as fecha_inicio_tratamiento
      from public.asignaciones_paciente ap
      join public.pacientes             pa on pa.id = ap.paciente_id
     where ap.terapeuta_id = p_terapeuta_id
       and ap.fecha_hasta  is null
     order by pa.nombre;
end;
$$;

comment on function public.list_pacientes_by_terapeuta(uuid) is
  'Lista los pacientes activos asignados a un terapeuta, con nivel actual (max de niveles en etapas no finalizadas) y última evaluación (max fecha_respuesta cross-etapa). Acceso: el propio terapeuta o un admin.';

grant execute on function public.list_pacientes_by_terapeuta(uuid) to authenticated;
