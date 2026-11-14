-- ---------------------------------------------------------------------------
-- is_admin / is_console_user
-- ---------------------------------------------------------------------------
-- Split out of the old 25_admin_functions.sql (fix/schema-load-order).
--
-- Root cause: `supabase db diff` replays supabase/schemas/*.sql in
-- lexicographic order into a shadow db, and `check_function_bodies` (on by
-- default) validates a `language sql` function's body at CREATE time. Both
-- functions below select from public.profiles/public.roles, so they must
-- load after those tables (01_roles.sql, 11_profiles.sql) but before every
-- consumer (las políticas RLS — documentadas en docs/rls/ — y los RPC).
-- The old home, 25_admin_functions.sql, loaded too late.
--
-- Fix shape: this file sits right after 11_profiles.sql (the last table
-- these functions depend on) and before every consumer.
-- 15 is an unused gap between 14_algoritmo_etapas.sql and 16_causa_frases.sql;
-- no other file was renumbered.
--
-- `has_active_assignment` stayed out of this file on purpose: it depends on
-- public.asignaciones_paciente (30_asignaciones_paciente.sql), loaded much
-- later. It now lives in 30_has_active_assignment.sql. See that file for the
-- companion fix.
-- ---------------------------------------------------------------------------

-- Oráculo de roles (seguridadPanel / SEG-005). Las dos funciones aceptan un
-- p_user_id para los casos en que auth.uid() es null: las Edge Functions con
-- service role (paciente-invitacion pasa el id del llamador) y los RPC que
-- reciben p_caller_id (deactivate_terapeuta, reactivate_terapeuta,
-- baja_voluntaria_paciente). Pero cualquiera con una sesión —un paciente—
-- podía llamar is_admin('<uuid ajeno>') por PostgREST y averiguar quién es
-- admin o terapeuta.
--
-- Regla: a un usuario final (rol del JWT `authenticated` o `anon`) solo le
-- responden sobre sí mismo; preguntar por otro devuelve false. A service_role
-- y a las llamadas internas sin JWT (migraciones, cron, tests) les responden
-- sobre cualquiera. Las policies y los RPC del panel las llaman sin argumento
-- (p_user_id = auth.uid()): no cambian.
--
-- Terapeuta desactivado (seguridadPanel / SEG-007). Desactivar a un terapeuta
-- lo banea en Auth, pero el access token que ya tiene sigue siendo válido hasta
-- que vence (jwt_expiry, 1 h): ni PostgREST ni el proxy del panel consultan el
-- ban. Por eso las dos funciones devuelven false para un usuario cuya fila en
-- public.terapeutas está en estado `inactivo`: RLS y los RPC lo frenan en el
-- acto, y el proxy lo expulsa cuando vence su memoria de 60 s.
--   - Solo `inactivo` corta. `pendiente` no: el invitado pasa a `activo` al
--     verificar el link (handle_terapeuta_email_confirmed), antes de llegar a
--     /auth/update-password; y estado_id es nullable, así que exigir `activo`
--     dejaría afuera a cualquier fila sin estado.
--   - Un admin sin fila en terapeutas no se ve afectado. Un admin-terapeuta
--     desactivado pierde también is_admin(): está baneado, no debe conservar
--     permisos de admin durante la hora que le queda de token.
--
-- Son plpgsql y no `language sql` a propósito: este archivo carga antes que
-- 20_terapeutas.sql, y Postgres valida el cuerpo de una función SQL al crearla
-- (check_function_bodies); plpgsql resuelve las tablas recién al ejecutar.
--
-- Nunca devuelven NULL: un guard `if not is_admin()` con NULL no entra y deja
-- pasar.

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

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated, service_role;

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

-- Las evalúan las policies con el rol del usuario: authenticated necesita execute.
revoke execute on function public.is_console_user(uuid) from public, anon;
grant execute on function public.is_console_user(uuid) to authenticated, service_role;
