-- =============================================================================
-- baja_voluntaria.sql — Assertion tests for baja-voluntaria-cuenta-paciente
-- =============================================================================
-- Coverage: SDD spec/design for baja-voluntaria-cuenta-paciente, Layer A.
--   BLOCK 1-3 — Phase 1, DB foundational (catalog seed, outbox cascade A14,
--               register_paciente email guard A13)
--   BLOCK 4-9 — Phase 2, core RPC (A1/A5/A6/A7/A8 happy path, A2/A3/A4 OTP
--               guards, A9/A10 idempotency + authz, A11/A12 grants, edge cases)
-- The Edge Function (Phase 3) is covered by Deno tests, not here.
--
-- TOOLING (mirrors supabase/tests/otp_functions.sql — no pgTAP):
--   SQL assertion blocks using DO $$ ... ASSERT ... $$ wrapped in transactions
--   that ROLLBACK after each group to keep the DB clean.
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -f supabase/tests/baja_voluntaria.sql
--
-- PREREQUISITES:
--   - The schema in supabase/schemas/ has been applied (npx supabase db reset).
--
-- STYLE GUIDE: .claude/sql-style-guide.md (snake_case, lowercase keywords,
-- explicit schema prefixes, readable whitespace, comments on complex logic)
-- =============================================================================

\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 (Task 1.1/1.2) — estados_paciente gains baja_voluntaria, idempotently
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_baja_count  int;
  v_activo_row  record;
  v_pausado_row record;
begin
  raise notice '--- BLOCK 1: estados_paciente baja_voluntaria seed ---';

  select count(*) into v_baja_count
    from public.estados_paciente
   where codigo = 'baja_voluntaria';

  assert v_baja_count = 1,
    format('BLOCK 1: expected exactly 1 baja_voluntaria row, found %s', v_baja_count);

  -- Idempotency: re-running the seed insert (on conflict do nothing) must not
  -- duplicate the row. Mirrors the actual statement in the hand-authored
  -- migration and the schema mirror.
  insert into public.estados_paciente (id, codigo, nombre, descripcion) values
    ('a3000003-0000-0000-0000-000000000000', 'baja_voluntaria', 'Baja voluntaria',
     'El paciente eliminó su propia cuenta desde la app; la ficha clínica se conserva')
  on conflict (codigo) do nothing;

  select count(*) into v_baja_count
    from public.estados_paciente
   where codigo = 'baja_voluntaria';

  assert v_baja_count = 1,
    format(
      'BLOCK 1: expected exactly 1 baja_voluntaria row after re-running the seed insert, found %s',
      v_baja_count
    );

  -- Pre-existing estados are untouched (same id, codigo, nombre).
  select id, codigo, nombre into v_activo_row
    from public.estados_paciente where codigo = 'activo';

  assert v_activo_row.id::text = 'a3000001-0000-0000-0000-000000000000',
    format('BLOCK 1: activo estado id drifted, got %s', v_activo_row.id);
  assert v_activo_row.nombre = 'Activo',
    format('BLOCK 1: activo estado nombre drifted, got %L', v_activo_row.nombre);

  select id, codigo, nombre into v_pausado_row
    from public.estados_paciente where codigo = 'pausado';

  assert v_pausado_row.id::text = 'a3000002-0000-0000-0000-000000000000',
    format('BLOCK 1: pausado estado id drifted, got %s', v_pausado_row.id);
  assert v_pausado_row.nombre = 'Pausado',
    format('BLOCK 1: pausado estado nombre drifted, got %L', v_pausado_row.nombre);

  raise notice 'BLOCK 1 PASSED: baja_voluntaria seeded exactly once, idempotent, estados activo/pausado untouched';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 (Task 1.3, spec A14) — notificaciones_outbox cascades on profile
-- deletion
-- ─────────────────────────────────────────────────────────────────────────────
-- The table has no writers anywhere in the codebase today (spec, grounded
-- references) — this is the only test keeping the FK change honest.

begin;

do $$
declare
  v_user_id    uuid := gen_random_uuid();
  v_outbox_id  uuid;
  v_row_count  int;
begin
  raise notice '--- BLOCK 2 (A14): notificaciones_outbox cascades on profile deletion ---';

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'baja-voluntaria-a14@example.test',
    crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );
  -- on_auth_user_created (99_auth_hooks.sql) auto-creates the public.profiles row.

  insert into public.notificaciones_outbox (
    destinatario_id, destinatario_tipo, canal, tipo, payload, programada_para
  ) values (
    v_user_id, 'paciente', 'email', 'test_a14', '{}'::jsonb, now()
  )
  returning id into v_outbox_id;

  -- This delete cascades auth.users -> profiles (pre-existing FK) and, with
  -- this change, profiles -> notificaciones_outbox. Pre-change, the second
  -- hop is NO ACTION and this statement raises a foreign key violation.
  delete from auth.users where id = v_user_id;

  select count(*) into v_row_count
    from public.notificaciones_outbox
   where id = v_outbox_id;

  assert v_row_count = 0,
    format('A14: expected outbox row %s to be cascade-deleted, found %s row(s)', v_outbox_id, v_row_count);

  select count(*) into v_row_count
    from public.profiles
   where id = v_user_id;

  assert v_row_count = 0,
    'A14: expected profiles row to be gone after auth.users delete';

  raise notice 'BLOCK 2 (A14) PASSED: notificaciones_outbox cascades on profile deletion';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 (Task 1.4, spec A13) — register_paciente distinguishes a
-- baja_voluntaria email collision from a generic unique violation
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user     uuid := gen_random_uuid();
  v_terapeuta_role     uuid;
  v_baja_estado        uuid;
  v_activo_estado      uuid;
  v_baja_paciente_id   uuid;
  v_activo_paciente_id uuid;
  -- M_BOSQUE_16, seeded as a literal FK by
  -- 20260719120000_seed_reference_lookups.sql — stable across environments.
  v_modalidad_id       uuid := 'b2000002-0000-0000-0000-000000000000';
begin
  raise notice '--- BLOCK 3 (A13): register_paciente baja_voluntaria email guard ---';

  -- Set up a therapist caller so register_paciente's authz guard passes.
  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'baja-voluntaria-a13-terapeuta@example.test',
    crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  select id into v_baja_estado   from public.estados_paciente where codigo = 'baja_voluntaria';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';

  assert v_baja_estado is not null,
    'A13 precondition failed: baja_voluntaria estado must exist (see BLOCK 1)';

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente Baja A13', '1990-01-01', 'a13-baja@example.test', '+541155560001', v_baja_estado, false)
  returning id into v_baja_paciente_id;

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente Activo A13', '1990-01-01', 'a13-activo@example.test', '+541155560002', v_activo_estado, true)
  returning id into v_activo_paciente_id;

  -- Simulate the therapist's JWT: auth.uid() reads request.jwt.claim.sub.
  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  -- Branch 1: email belongs to a baja_voluntaria patient -> paciente_dado_de_baja (P0001).
  begin
    perform public.register_paciente(
      p_nombre           => 'Nuevo Paciente A13',
      p_fecha_nacimiento => '1995-05-05',
      p_email            => 'a13-baja@example.test',
      p_telefono         => '+541155560901',
      p_causa_id         => gen_random_uuid(),
      p_algoritmo_id     => gen_random_uuid(),
      p_modalidad_id     => v_modalidad_id,
      p_bloqueo_ids      => array[]::uuid[],
      p_alfabetos        => '[]'::jsonb,
      p_terapeuta_id     => v_terapeuta_user
    );
    assert false,
      'A13: expected register_paciente to raise paciente_dado_de_baja for a baja_voluntaria email, but it succeeded';
  exception
    when sqlstate 'P0001' then
      assert sqlerrm = 'paciente_dado_de_baja',
        format('A13: expected message paciente_dado_de_baja, got %L', sqlerrm);
  end;

  assert (select count(*) from public.pacientes where email = 'a13-baja@example.test') = 1,
    'A13: expected no new pacientes row to be inserted for the baja_voluntaria email';

  -- Branch 2: email belongs to an ACTIVE patient -> unchanged behavior, raw 23505.
  begin
    perform public.register_paciente(
      p_nombre           => 'Otro Paciente A13',
      p_fecha_nacimiento => '1995-05-05',
      p_email            => 'a13-activo@example.test',
      p_telefono         => '+541155560902',
      p_causa_id         => gen_random_uuid(),
      p_algoritmo_id     => gen_random_uuid(),
      p_modalidad_id     => v_modalidad_id,
      p_bloqueo_ids      => array[]::uuid[],
      p_alfabetos        => '[]'::jsonb,
      p_terapeuta_id     => v_terapeuta_user
    );
    assert false,
      'A13: expected register_paciente to raise a unique violation for an active-patient email collision, but it succeeded';
  exception
    when unique_violation then
      null; -- expected: raw 23505 on pacientes_email_key, guard must not intercept active emails
  end;

  assert (select count(*) from public.pacientes where email = 'a13-activo@example.test') = 1,
    'A13: expected no new pacientes row to be inserted for the active-patient email collision';

  raise notice 'BLOCK 3 (A13) PASSED: register_paciente distinguishes baja_voluntaria vs active email collisions';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 (Tasks 2.1/2.4/2.5, spec A1/A5/A6/A7/A8) — baja_voluntaria_paciente
-- happy path: FK ordering, core mutation, assignment/etapa closure, audit trail
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_paciente_user  uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_etapa_activa   uuid;
  v_paciente_id    uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_result         jsonb;
  v_paciente_row   record;
  v_asignacion_row record;
  v_etapa_row      record;
  v_audit_row      record;
  v_audit_count    int;
  v_in_list        boolean;
  v_fk_blocked     boolean := false;
begin
  raise notice '--- BLOCK 4 (A1/A5/A6/A7/A8): baja_voluntaria_paciente happy path ---';

  select id into v_terapeuta_role from public.roles          where codigo = 'terapeuta';
  select id into v_activo_estado  from public.estados_paciente where codigo = 'activo';
  select id into v_etapa_activa   from public.estados_etapa    where codigo = 'activa';
  select id into v_causa_id       from public.causas     limit 1;
  select id into v_algoritmo_id   from public.algoritmos limit 1;

  assert v_causa_id is not null and v_algoritmo_id is not null,
    'BLOCK 4 precondition failed: causas/algoritmos catalogs must be seeded';

  -- Therapist account.
  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bv-b4-terapeuta@example.test',
    crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  -- Patient account, linked to a clinical record.
  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_paciente_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bv-b4-paciente@example.test',
    crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo, user_id)
  values ('Paciente B4', '1990-01-01', 'bv-b4-paciente@example.test', '+541155560003', v_activo_estado, true, v_paciente_user)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id,
    public.hoy() - 30, v_etapa_activa
  );

  -- A1 (first half) — the ORDERING invariant. While pacientes.user_id points at
  -- the auth user, deleting that auth user must fail: the FK has no "on delete"
  -- clause, so it is NO ACTION. This is the entire reason the RPC exists and runs
  -- BEFORE auth.admin.deleteUser(). A refactor that swaps the two steps fails here.
  begin
    delete from auth.users where id = v_paciente_user;
  exception
    when foreign_key_violation then
      v_fk_blocked := true;
  end;

  assert v_fk_blocked,
    'A1: expected deleting auth.users to raise 23503 while pacientes.user_id still references it';

  -- Run the RPC.
  v_result := public.baja_voluntaria_paciente(v_paciente_user);

  assert v_result->>'status' = 'ok',
    format('A5: expected status ok on first call, got %L', v_result->>'status');
  assert (v_result->>'pacienteId')::uuid = v_paciente_id,
    format('A5: expected pacienteId %s, got %s', v_paciente_id, v_result->>'pacienteId');

  -- A5 — core mutation on the clinical record.
  select estado_id, activo, user_id, fecha_cambio_estado, motivo_cambio_estado
    into v_paciente_row
    from public.pacientes where id = v_paciente_id;

  assert v_paciente_row.estado_id = (select id from public.estados_paciente where codigo = 'baja_voluntaria'),
    'A5: expected estado_id to be baja_voluntaria';
  assert v_paciente_row.activo = false,
    'A5: expected activo = false';
  assert v_paciente_row.user_id is null,
    'A5: expected user_id to be nulled (this is what unblocks the auth delete)';
  assert v_paciente_row.fecha_cambio_estado is not null,
    'A5: expected fecha_cambio_estado to be set';
  assert v_paciente_row.motivo_cambio_estado is not null,
    'A5: expected motivo_cambio_estado to be set';

  -- A6 — the active assignment is closed. This, not the estado catalog, is what
  -- removes the patient from every therapist-facing surface: they all filter on
  -- fecha_hasta is null. Asserted at the consumer too, because that is where the
  -- ghost-patient invariant actually lives.
  select fecha_hasta, motivo into v_asignacion_row
    from public.asignaciones_paciente where paciente_id = v_paciente_id;

  assert v_asignacion_row.fecha_hasta = public.hoy(),
    format('A6: expected fecha_hasta = public.hoy(), got %s', v_asignacion_row.fecha_hasta);
  assert v_asignacion_row.motivo is not null,
    'A6: expected motivo to record why the assignment was closed';

  -- list_pacientes_by_terapeuta exige sesión de consola desde seguridadPanel
  -- (SEG-005/SEG-008): se consulta como el propio terapeuta y después se vuelve
  -- a dejar la transacción sin usuario, como estaba.
  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  select exists (
    select 1 from public.list_pacientes_by_terapeuta(v_terapeuta_user)
     where paciente_nombre = 'Paciente B4'
  ) into v_in_list;

  perform set_config('request.jwt.claim.sub', '', true);

  assert not v_in_list,
    'A6: expected the patient to disappear from list_pacientes_by_terapeuta after the baja';

  -- A7 — the active etapa is closed as abandonada.
  select estado_id, fecha_finalizacion, motivo_cierre into v_etapa_row
    from public.etapas_tratamiento where paciente_id = v_paciente_id;

  assert v_etapa_row.estado_id = (select id from public.estados_etapa where codigo = 'abandonada'),
    'A7: expected the active etapa to be closed as abandonada';
  assert v_etapa_row.fecha_finalizacion = public.hoy(),
    format('A7: expected fecha_finalizacion = public.hoy(), got %s', v_etapa_row.fecha_finalizacion);
  assert v_etapa_row.motivo_cierre is not null,
    'A7: expected motivo_cierre to be set';

  -- A8 — exactly one audit row, with the requester recoverable from
  -- datos_anteriores. usuario_id must be null: profiles is about to be cascade
  -- deleted and audit_log.usuario_id references it with NO ACTION.
  select count(*) into v_audit_count
    from public.audit_log
   where tabla = 'pacientes'
     and registro_id = v_paciente_id::text
     and operacion = 'baja_voluntaria';

  assert v_audit_count = 1,
    format('A8: expected exactly 1 baja_voluntaria audit row, found %s', v_audit_count);

  select usuario_id, datos_anteriores into v_audit_row
    from public.audit_log
   where tabla = 'pacientes'
     and registro_id = v_paciente_id::text
     and operacion = 'baja_voluntaria';

  assert v_audit_row.usuario_id is null,
    'A8: expected audit_log.usuario_id to be null (profiles row is about to be cascade-deleted)';
  assert (v_audit_row.datos_anteriores->>'user_id')::uuid = v_paciente_user,
    'A8: expected datos_anteriores.user_id to preserve the deleted auth user id';

  -- A1 (second half) — with user_id nulled, the auth delete now succeeds. This is
  -- step 2 of the Edge Function flow.
  delete from auth.users where id = v_paciente_user;

  assert not exists (select 1 from auth.users where id = v_paciente_user),
    'A1: expected the auth user to be deletable once the RPC nulled pacientes.user_id';
  assert exists (select 1 from public.pacientes where id = v_paciente_id),
    'A1: expected the clinical record to survive the auth user deletion';

  raise notice 'BLOCK 4 (A1/A5/A6/A7/A8) PASSED: ordering enforced, record marked, assignment+etapa closed, audit written';
end;
$$;

rollback;


-- BLOCK 5 — omitido en la versión pública (dependía del flujo de OTP).

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6 (Tasks 2.3/2.5, spec A9/A10) — idempotent re-entry and the role guard
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_admin_user     uuid := gen_random_uuid();
  v_paciente_user  uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_admin_role     uuid;
  v_activo_estado  uuid;
  v_paciente_id    uuid;
  v_result         jsonb;
  v_audit_count    int;
  v_raised         boolean;
begin
  raise notice '--- BLOCK 6 (A9/A10): idempotency and role guard ---';

  select id into v_terapeuta_role from public.roles           where codigo = 'terapeuta';
  select id into v_admin_role     from public.roles           where codigo = 'admin';
  select id into v_activo_estado  from public.estados_paciente where codigo = 'activo';

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bv-b6-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bv-b6-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_paciente_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'bv-b6-paciente@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  update public.profiles set rol_id = v_admin_role     where id = v_admin_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo, user_id)
  values ('Paciente B6', '1992-07-07', 'bv-b6-paciente@example.test', '+541155560005', v_activo_estado, true, v_paciente_user)
  returning id into v_paciente_id;

  -- A9 — first call succeeds, second call is a no-op that still returns 200-shaped
  -- data. Returning instead of raising is what makes the Edge Function's retry the
  -- recovery path when auth.admin.deleteUser fails after the RPC has committed.
  v_result := public.baja_voluntaria_paciente(v_paciente_user);
  assert v_result->>'status' = 'ok',
    format('A9: expected first call to return ok, got %L', v_result->>'status');

  v_result := public.baja_voluntaria_paciente(v_paciente_user);
  assert v_result->>'status' = 'ya_dado_de_baja',
    format('A9: expected second call to return ya_dado_de_baja, got %L', v_result->>'status');
  assert v_result->>'pacienteId' is null,
    'A9: expected pacienteId to be null on the idempotent branch';

  select count(*) into v_audit_count
    from public.audit_log
   where tabla = 'pacientes'
     and registro_id = v_paciente_id::text
     and operacion = 'baja_voluntaria';

  assert v_audit_count = 1,
    format('A9: expected the retry to write no second audit row, found %s', v_audit_count);

  -- A10 — a therapist reaching this endpoint must be rejected, not silently
  -- handed the idempotent branch. Deleting their auth user would cascade
  -- profiles -> terapeutas and destroy assignment history.
  v_raised := false;
  begin
    perform public.baja_voluntaria_paciente(v_terapeuta_user);
  exception
    when insufficient_privilege then
      v_raised := true;
      assert sqlerrm = 'no_autorizado',
        format('A10: expected message no_autorizado, got %L', sqlerrm);
  end;
  assert v_raised, 'A10: expected 42501 no_autorizado for a therapist caller';

  assert exists (select 1 from public.terapeutas where id = v_terapeuta_user),
    'A10: expected the therapist row to be untouched';

  -- Same for an admin.
  v_raised := false;
  begin
    perform public.baja_voluntaria_paciente(v_admin_user);
  exception
    when insufficient_privilege then
      v_raised := true;
  end;
  assert v_raised, 'A10: expected 42501 no_autorizado for an admin caller';

  -- And fail closed on a null id, which would otherwise fall through every
  -- lookup and reach the idempotent return with no identity at all.
  v_raised := false;
  begin
    perform public.baja_voluntaria_paciente(null);
  exception
    when insufficient_privilege then
      v_raised := true;
  end;
  assert v_raised, 'A10: expected 42501 no_autorizado for a null p_user_id';

  raise notice 'BLOCK 6 (A9/A10) PASSED: retry is idempotent, therapists/admins/null rejected';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 7 (Task 2.9, spec A11/A12) — grant posture and search_path
-- These two are the IDOR control and the migra gap. Asserted directly, because
-- db diff detects neither EXECUTE grants nor proconfig.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_authenticated boolean;
  v_service_role  boolean;
  v_anon          boolean;
  v_proconfig     text[];
begin
  raise notice '--- BLOCK 7 (A11/A12): grants and search_path ---';

  select has_function_privilege('authenticated', 'public.baja_voluntaria_paciente(uuid)', 'execute')
    into v_authenticated;
  select has_function_privilege('service_role',  'public.baja_voluntaria_paciente(uuid)', 'execute')
    into v_service_role;
  select has_function_privilege('anon',          'public.baja_voluntaria_paciente(uuid)', 'execute')
    into v_anon;

  -- A11 — this is the whole anti-IDOR control. With execute granted to
  -- authenticated, any logged-in patient could call the RPC with somebody else's
  -- p_user_id and close their account.
  assert v_authenticated = false,
    'A11: authenticated must NOT be able to execute baja_voluntaria_paciente (IDOR control)';
  assert v_anon = false,
    'A11: anon must NOT be able to execute baja_voluntaria_paciente';
  assert v_service_role = true,
    'A11: service_role must be able to execute baja_voluntaria_paciente (the Edge Function)';

  -- A12 — a security definer function without a pinned search_path is a
  -- privilege-escalation vector. migra does not emit proconfig, so the hand
  -- authored migration sets it and this assertion is what keeps it honest.
  select proconfig into v_proconfig
    from pg_proc where proname = 'baja_voluntaria_paciente';

  assert v_proconfig is not null,
    'A12: expected baja_voluntaria_paciente to have a proconfig (search_path pinned)';
  assert exists (select 1 from unnest(v_proconfig) as c where c like 'search_path=%'),
    format('A12: expected search_path= in proconfig, got %L', v_proconfig);

  raise notice 'BLOCK 7 (A11/A12) PASSED: execute revoked from authenticated/anon, granted to service_role, search_path pinned';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 8 (Task 2.5) — edge cases: a patient with no active etapa is a valid
-- no-op, and a failure anywhere in the RPC rolls the whole baja back
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_paciente_user uuid := gen_random_uuid();
  v_activo_estado uuid;
  v_paciente_id   uuid;
  v_result        jsonb;
  v_etapa_count   int;
begin
  raise notice '--- BLOCK 8: no-active-etapa no-op ---';

  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_paciente_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bv-b8-paciente@example.test',
    crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  -- Deliberately no assignment and no etapa: a patient who never started
  -- treatment must still be able to delete their account.
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo, user_id)
  values ('Paciente B8', '1995-11-11', 'bv-b8-paciente@example.test', '+541155560006', v_activo_estado, true, v_paciente_user)
  returning id into v_paciente_id;

  v_result := public.baja_voluntaria_paciente(v_paciente_user);

  assert v_result->>'status' = 'ok',
    format('BLOCK 8: expected ok for a patient with no etapa/assignment, got %L', v_result->>'status');

  select count(*) into v_etapa_count
    from public.etapas_tratamiento where paciente_id = v_paciente_id;

  assert v_etapa_count = 0,
    'BLOCK 8: expected the RPC not to invent an etapa row';

  assert (select user_id from public.pacientes where id = v_paciente_id) is null,
    'BLOCK 8: expected user_id to be nulled even with no etapa to close';

  raise notice 'BLOCK 8 PASSED: patient with no active etapa/assignment is a clean no-op';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 9 (Task 2.5) — atomicity: the baja is one transaction. If any step
-- fails, nothing is committed. Forced here by removing the estados_etapa row
-- the RPC needs, so step 1's catalog lookup aborts before any mutation.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_paciente_user uuid := gen_random_uuid();
  v_activo_estado uuid;
  v_paciente_id   uuid;
  v_raised        boolean := false;
begin
  raise notice '--- BLOCK 9: catalog gap aborts before mutating ---';

  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';

  insert into auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_paciente_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'bv-b9-paciente@example.test',
    crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    now(), now(), '', '', '', ''
  );

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo, user_id)
  values ('Paciente B9', '1991-02-02', 'bv-b9-paciente@example.test', '+541155560007', v_activo_estado, true, v_paciente_user)
  returning id into v_paciente_id;

  -- Rename the catalog row out from under the RPC. Renaming rather than deleting
  -- avoids the FK from etapas_tratamiento.estado_id, and exercises the same
  -- lookup-by-codigo path the RPC uses.
  update public.estados_etapa set codigo = 'abandonada_tmp' where codigo = 'abandonada';

  begin
    perform public.baja_voluntaria_paciente(v_paciente_user);
  exception
    when sqlstate 'P0002' then
      v_raised := true;
      assert sqlerrm = 'estado_etapa_abandonada_no_encontrado',
        format('BLOCK 9: expected estado_etapa_abandonada_no_encontrado, got %L', sqlerrm);
  end;

  assert v_raised,
    'BLOCK 9: expected P0002 when the abandonada catalog row is missing';

  -- The critical assertion: the catalog is resolved BEFORE any mutation, so the
  -- patient must be completely untouched. A body that mutated first and looked up
  -- the catalog later would leave a half-applied baja here.
  assert (select user_id  from public.pacientes where id = v_paciente_id) = v_paciente_user,
    'BLOCK 9: expected user_id to be untouched when the RPC aborts';
  assert (select estado_id from public.pacientes where id = v_paciente_id) = v_activo_estado,
    'BLOCK 9: expected estado_id to be untouched when the RPC aborts';
  assert not exists (
    select 1 from public.audit_log
     where registro_id = v_paciente_id::text and operacion = 'baja_voluntaria'
  ), 'BLOCK 9: expected no audit row when the RPC aborts';

  raise notice 'BLOCK 9 PASSED: a missing catalog row aborts the baja with nothing mutated';
end;
$$;

rollback;
