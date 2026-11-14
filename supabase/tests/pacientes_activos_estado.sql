-- =============================================================================
-- pacientes_activos_estado.sql — pulidoBeta / BETA-014
--
-- "Paciente activo" (CONTEXT.md) = estado `activo` de estados_paciente. El stat
-- totales.pacientes_activos de get_admin_dashboard_stats contaba a todo paciente
-- con una asignación vigente, incluidos los pausados y los dados de baja.
--
--   BLOCK 1 — un paciente activo con asignación vigente suma 1; al pasarlo a
--             `pausado` deja de contar (la asignación sigue vigente); un
--             paciente activo SIN tratamiento en curso sí cuenta.
--
-- Corre dentro de begin/rollback: no deja datos.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/pacientes_activos_estado.sql
-- =============================================================================

begin;

do $$
declare
  v_admin_user     uuid := gen_random_uuid();
  v_admin_role     uuid;
  v_activo_estado  uuid;
  v_pausado_estado uuid;
  v_paciente_id    uuid;
  v_base           int;
  v_actual         int;
begin
  raise notice '--- BLOCK 1: pacientes_activos cuenta solo el estado activo ---';

  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_pausado_estado from public.estados_paciente where codigo = 'pausado';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'beta014-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  insert into public.terapeutas (id) values (v_admin_user);

  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);

  -- Línea de base: la red tal como está, antes de sumar el paciente de prueba.
  select (public.get_admin_dashboard_stats() -> 'totales' ->> 'pacientes_activos')::int
    into v_base;

  -- Paciente en estado activo, con asignación vigente y SIN ninguna etapa:
  -- tener o no un tratamiento en curso no decide si es activo.
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente BETA014', '1990-01-01', 'beta014-paciente@example.test', '+541155550184', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_admin_user, public.hoy());

  select (public.get_admin_dashboard_stats() -> 'totales' ->> 'pacientes_activos')::int
    into v_actual;
  assert v_actual = v_base + 1,
    format('BLOCK 1: un paciente activo sin tratamiento en curso debe contar (%s→%s)', v_base, v_actual);

  -- Pausado: la asignación sigue vigente, pero ya no es un paciente activo.
  update public.pacientes set estado_id = v_pausado_estado where id = v_paciente_id;

  select (public.get_admin_dashboard_stats() -> 'totales' ->> 'pacientes_activos')::int
    into v_actual;
  assert v_actual = v_base,
    format('BLOCK 1: un paciente pausado con asignación vigente NO debe contar (%s→%s)', v_base, v_actual);

  raise notice 'BLOCK 1 PASSED: pacientes_activos sigue al estado del paciente, no a la asignación';
end;
$$;

rollback;
