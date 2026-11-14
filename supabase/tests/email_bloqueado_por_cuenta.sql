-- =============================================================================
-- email_bloqueado_por_cuenta.sql — pulidoBeta / BETA-030
--
-- Una vez que el paciente activó su cuenta (pacientes.user_id no nulo), el
-- "Email de la ficha" (CONTEXT.md) no se puede cambiar desde la edición:
-- update_paciente_identidad lo rechaza con `email_bloqueado_por_cuenta`. Antes
-- lo pisaba sin mirar user_id y la ficha quedaba con un email distinto al del
-- login, sin que nadie se enterara.
--
--   BLOCK 1 — paciente activado + email distinto → falla con
--             email_bloqueado_por_cuenta (P0001) y no se guarda nada.
--   BLOCK 2 — paciente activado + el mismo email con otras mayúsculas y
--             espacios → pasa, guarda el resto de los datos y NO altera el
--             email guardado.
--   BLOCK 3 — paciente sin activar → el email se cambia como siempre.
--
-- Corre dentro de begin/rollback: no deja datos.
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/email_bloqueado_por_cuenta.sql
-- =============================================================================

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_paciente_user  uuid := gen_random_uuid();
  v_activo_estado  uuid;
  v_activado_id    uuid;
  v_sin_activar_id uuid;
  v_fallo          boolean;
  v_nombre         text;
  v_email          text;
begin
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'beta030-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  ),
  (
    v_paciente_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'beta030-activado@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  insert into public.terapeutas (id) values (v_terapeuta_user);
  -- El guard exige un usuario de consola (seguridadPanel / SEG-008): una fila
  -- en terapeutas sin rol en profiles no alcanza.
  update public.profiles
     set rol_id = (select r.id from public.roles as r where r.codigo = 'terapeuta')
   where id = v_terapeuta_user;

  -- Paciente que ya activó su cuenta (user_id vinculado).
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo, user_id)
  values ('Activado BETA030', '1990-01-01', 'beta030-activado@example.test', '+541155550301',
          v_activo_estado, true, v_paciente_user)
  returning id into v_activado_id;

  -- Paciente que todavía no activó.
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Sin activar BETA030', '1991-02-02', 'beta030-sin-activar@example.test', '+541155550302',
          v_activo_estado, true)
  returning id into v_sin_activar_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_activado_id, v_terapeuta_user, public.hoy()),
         (v_sin_activar_id, v_terapeuta_user, public.hoy());

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  raise notice '--- BLOCK 1: paciente activado + email distinto → email_bloqueado_por_cuenta ---';

  v_fallo := false;
  begin
    perform public.update_paciente_identidad(
      v_activado_id, 'Nombre Nuevo', '1990-01-01', 'beta030-otro@example.test', '+541155550301'
    );
  exception
    when sqlstate 'P0001' then
      assert sqlerrm = 'email_bloqueado_por_cuenta',
        format('BLOCK 1: se esperaba email_bloqueado_por_cuenta, llegó "%s"', sqlerrm);
      v_fallo := true;
  end;
  assert v_fallo,
    'BLOCK 1: cambiar el email de un paciente con cuenta debe fallar con email_bloqueado_por_cuenta';

  select nombre, email into v_nombre, v_email from public.pacientes where id = v_activado_id;
  assert v_nombre = 'Activado BETA030' and v_email = 'beta030-activado@example.test',
    format('BLOCK 1: el rechazo no debe guardar nada (nombre=%s, email=%s)', v_nombre, v_email);

  raise notice 'BLOCK 1 PASSED';

  raise notice '--- BLOCK 2: paciente activado + mismo email (mayúsculas/espacios) → guarda el resto ---';

  perform public.update_paciente_identidad(
    v_activado_id, 'Activado Renombrado', '1990-01-01', '  BETA030-Activado@Example.TEST ', '+541155550301'
  );

  select nombre, email into v_nombre, v_email from public.pacientes where id = v_activado_id;
  assert v_nombre = 'Activado Renombrado',
    format('BLOCK 2: el resto de los datos se debe guardar (nombre=%s)', v_nombre);
  assert v_email = 'beta030-activado@example.test',
    format('BLOCK 2: el email guardado no se debe alterar (email=%s)', v_email);

  raise notice 'BLOCK 2 PASSED';

  raise notice '--- BLOCK 3: paciente sin activar → el email se cambia ---';

  perform public.update_paciente_identidad(
    v_sin_activar_id, 'Sin activar BETA030', '1991-02-02', ' beta030-nuevo@example.test ', '+541155550302'
  );

  select email into v_email from public.pacientes where id = v_sin_activar_id;
  assert v_email = 'beta030-nuevo@example.test',
    format('BLOCK 3: sin cuenta, el email se debe poder cambiar (email=%s)', v_email);

  raise notice 'BLOCK 3 PASSED';
end;
$$;

rollback;
