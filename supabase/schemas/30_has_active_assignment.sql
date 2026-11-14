-- ---------------------------------------------------------------------------
-- has_active_assignment
-- ---------------------------------------------------------------------------
-- Moved out of 25_admin_functions.sql (fix/schema-load-order). This function
-- selects from public.asignaciones_paciente, which is only defined in
-- 30_asignaciones_paciente.sql — loaded after the old 25_ home, breaking
-- `supabase db diff` (check_function_bodies validates `language sql` bodies
-- at CREATE time).
--
-- Deliberately named 30_has_active_assignment.sql, sharing the "30" numeric
-- prefix with 30_asignaciones_paciente.sql rather than taking a new integer:
-- there is no unused integer between 30 and 31 (31_etapas_tratamiento.sql is
-- has_active_assignment's earliest consumer, via
-- terapeuta_select_etapas_via_asignacion_activa). Lexicographic sort resolves
-- the two "30_" files correctly on the differing next character
-- ("30_asignaciones_..." < "30_has_active_..." because 'a' < 'h'), so this
-- file still loads after the table it depends on and before 31_. No other
-- file was renumbered.
-- ---------------------------------------------------------------------------

-- Consola activa (seguridadPanel / SEG-008). Ser dueño de la asignación no
-- alcanza: el que consulta tiene que ser, además, usuario de consola
-- (public.is_console_user(), que da false para un terapeuta `inactivo`). Sin
-- eso, un terapeuta desactivado seguía leyendo y escribiendo por API con el
-- token que le quedaba, mientras alguna asignación abierta lo nombrara. Esta
-- función es el punto común de 8 policies y 7 RPC: el chequeo va acá y no en
-- cada uno. Nunca devuelve NULL (is_console_user() tampoco).
create or replace function public.has_active_assignment(p_paciente_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.is_console_user()
     and exists (
       select 1
         from public.asignaciones_paciente a
        where a.paciente_id  = p_paciente_id
          and a.terapeuta_id = auth.uid()
          and a.fecha_hasta is null
     );
$$;

comment on function public.has_active_assignment is
  'Devuelve true si auth.uid() es un usuario de consola activo (is_console_user(): un terapeuta inactivo da false, seguridadPanel / SEG-008) y tiene una asignación activa (fecha_hasta IS NULL) sobre el paciente dado. Usada en políticas RLS de tablas clínicas para habilitar handoff y como guard de los RPC de medición, cierre y alertas. Nunca devuelve NULL.';

-- La evalúan las policies de las tablas clínicas con el rol del usuario:
-- authenticated necesita execute (seguridadPanel / SEG-005). Sin login, no.
revoke execute on function public.has_active_assignment(uuid) from public, anon;
grant execute on function public.has_active_assignment(uuid) to authenticated, service_role;
