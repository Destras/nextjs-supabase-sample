-- =============================================================================
-- mediciones_estructura.sql — Assertion tests for sdd/medir-chakras PR1 (E0)
-- =============================================================================
-- Coverage: sdd/medir-chakras spec (#319) + design (#320/#321), DEC-31..34
-- (grill-decisions #317, correction #322).
--   BLOCK 1-2  — catalog + partial unique invariants (T0.1, T0.2)
--   BLOCK 3-5  — registrar_medicion happy path, validation, guards (T0.3)
--   BLOCK 6    — editar_medicion 4-condition rule (T0.4)
--   BLOCK 7    — get_estructura_paciente authz + envelope (T0.3)
--   BLOCK 8    — cerrar_etapa_con_medicion atomic close (T0.5)
--   BLOCK 9-11 — cierre_automatico integrity + DEC-31/33 authz matrix on
--                cerrar_etapa
--   BLOCK 12   — baja_voluntaria_paciente R5 (for loop, no limit 1)
--   BLOCK 13-14— DEC-32 marcar_alerta_atendida + medicion_cierre_pendiente
--   BLOCK 16   — EXECUTE privilege assert, design §2.5's 13-row inventory
--
-- TOOLING (mirrors supabase/tests/baja_voluntaria.sql — no pgTAP): SQL
-- assertion blocks using DO $$ ... ASSERT ... $$ wrapped in transactions that
-- ROLLBACK after each group to keep the DB clean.
--
-- ⚠️ GOTCHA — `now()` is constant for the whole enclosing transaction, not
-- wall-clock time. Two mediciones inserted via two RPC calls inside the SAME
-- begin/rollback block get the IDENTICAL registrada_en, so "the latest
-- medición" (order by registrada_en desc, id desc) would tie-break on a
-- RANDOM uuid instead of insertion order. In production this never happens
-- (every RPC call is its own PostgREST transaction, so registrada_en is
-- naturally chronological) — it only bites a test harness that calls the
-- RPCs repeatedly inside one transaction. Wherever a block needs a
-- deterministic "this one is older / this one is the latest" across 2+ rows,
-- it explicitly backdates registrada_en with a plain UPDATE right after the
-- insert (search "-- backdate" below) instead of trusting insertion order.
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -f supabase/tests/mediciones_estructura.sql
--
-- PREREQUISITES: supabase db reset (schema applied, including M1-M5).
--
-- STYLE GUIDE: .claude/sql-style-guide.md
-- =============================================================================

\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared fixture helper — creates a therapist + patient + assignment + one
-- started etapa, returns the etapa id. Not a real function (this file only
-- runs psql DO blocks, each independently rolled back), so every block
-- inlines its own copy of this setup, same convention as baja_voluntaria.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 (T0.1) — centros_energeticos: seeded catalog, read-only
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_count          int;
  v_raised         boolean;
begin
  raise notice '--- BLOCK 1 (T0.1): centros_energeticos seeded catalog, read-only ---';

  select count(*) into v_count from public.centros_energeticos where activo;
  assert v_count = 12, format('BLOCK 1: expected 12 active centros, found %s', v_count);

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'me-b1-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';

  v_raised := false;
  begin
    insert into public.centros_energeticos (codigo, nombre, etiqueta_paciente, orden)
    values ('intruso', 'Intruso', 'Intruso', 99);
  exception
    when insufficient_privilege then v_raised := true;
  end;
  assert v_raised, 'BLOCK 1: authenticated must not be able to INSERT into centros_energeticos';

  execute 'reset role';

  raise notice 'BLOCK 1 PASSED: 12 active centros seeded, no write path for authenticated';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 (T0.2) — mediciones_estructura/medicion_valores RLS scoping +
-- partial unique invariants (at most one apertura, one cierre/cierre_automatico
-- per etapa)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_asignado uuid := gen_random_uuid();
  v_terapeuta_ajeno    uuid := gen_random_uuid();
  v_terapeuta_role     uuid;
  v_activo_estado      uuid;
  v_activa_etapa       uuid;
  v_causa_id           uuid;
  v_algoritmo_id       uuid;
  v_modalidad_id       uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id        uuid;
  v_etapa_id           uuid;
  v_medicion_id        uuid;
  v_count              int;
  v_raised             boolean;
begin
  raise notice '--- BLOCK 2 (T0.2): partial unique invariants ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_terapeuta_asignado, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b2-asignado@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_terapeuta_ajeno, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b2-ajeno@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id in (v_terapeuta_asignado, v_terapeuta_ajeno);
  insert into public.terapeutas (id) values (v_terapeuta_asignado), (v_terapeuta_ajeno);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B2', '1990-01-01', 'me-b2-paciente@example.test', '+541155561001', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_asignado, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_asignado, v_causa_id, v_algoritmo_id, v_modalidad_id,
    public.hoy() - 10, v_activa_etapa
  ) returning id into v_etapa_id;

  -- Insert directly (postgres/owner) to exercise RLS/index invariants without
  -- routing through the RPC layer yet.
  insert into public.mediciones_estructura (etapa_id, momento, estructura_general, registrada_por)
  values (v_etapa_id, 'apertura', 50, v_terapeuta_asignado)
  returning id into v_medicion_id;

  insert into public.medicion_valores (medicion_id, centro_id, valor)
  select v_medicion_id, id, 50 from public.centros_energeticos where activo;

  -- Partial unique index: a second apertura on the same etapa is rejected.
  v_raised := false;
  begin
    insert into public.mediciones_estructura (etapa_id, momento, estructura_general, registrada_por)
    values (v_etapa_id, 'apertura', 60, v_terapeuta_asignado);
  exception
    when unique_violation then v_raised := true;
  end;
  assert v_raised, 'BLOCK 2: a second apertura on the same etapa must violate the partial unique index';

  -- Partial unique index: cierre + cierre_automatico collide too.
  insert into public.mediciones_estructura (etapa_id, momento, estructura_general, registrada_por)
  values (v_etapa_id, 'cierre', 70, v_terapeuta_asignado);

  v_raised := false;
  begin
    insert into public.mediciones_estructura (etapa_id, momento, estructura_general, registrada_por)
    values (v_etapa_id, 'cierre_automatico', 70, null);
  exception
    when unique_violation then v_raised := true;
  end;
  assert v_raised, 'BLOCK 2: cierre and cierre_automatico share the same partial unique index on etapa_id';

  raise notice 'BLOCK 2 PASSED: apertura/cierre partial unique indexes hold';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 (T0.3) — registrar_medicion happy path: apertura then seguimiento
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_centro_ids     uuid[];
  v_valores        jsonb;
  v_medicion1_id   uuid;
  v_medicion2_id   uuid;
  v_momento        text;
begin
  raise notice '--- BLOCK 3 (T0.3): registrar_medicion apertura -> seguimiento ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'me-b3-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B3', '1990-01-01', 'me-b3-paciente@example.test', '+541155561002', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id,
    public.hoy() - 10, v_activa_etapa
  ) returning id into v_etapa_id;

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  v_valores := jsonb_build_object(
    'estructura_general', 50,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 50)) from unnest(v_centro_ids) as c)
  );

  v_medicion1_id := public.registrar_medicion(v_etapa_id, v_valores, null);

  select momento into v_momento from public.mediciones_estructura where id = v_medicion1_id;
  assert v_momento = 'apertura', format('BLOCK 3: first medición must be apertura, got %L', v_momento);

  v_medicion2_id := public.registrar_medicion(v_etapa_id, v_valores, v_medicion1_id);

  select momento into v_momento from public.mediciones_estructura where id = v_medicion2_id;
  assert v_momento = 'seguimiento', format('BLOCK 3: second medición must be seguimiento, got %L', v_momento);

  assert v_medicion2_id <> v_medicion1_id, 'BLOCK 3: apertura and seguimiento must be distinct rows';

  raise notice 'BLOCK 3 PASSED: first medición is apertura, second (with correct previous id) is seguimiento';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 (T0.3) — registrar_medicion validation: 22023 on bad values, PT409
-- on stale p_medicion_previa_id
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_centro_ids     uuid[];
  v_valores        jsonb;
  v_raised         boolean;
  v_medicion_count int;
begin
  raise notice '--- BLOCK 4 (T0.3): registrar_medicion validation (22023/PT409) ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'me-b4-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B4', '1990-01-01', 'me-b4-paciente@example.test', '+541155561003', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id,
    public.hoy() - 10, v_activa_etapa
  ) returning id into v_etapa_id;

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  -- Missing a centro (centros_faltantes).
  v_valores := jsonb_build_object(
    'estructura_general', 50,
    'centros', (
      select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 50))
        from unnest(v_centro_ids[1:11]) as c
    )
  );

  v_raised := false;
  begin
    perform public.registrar_medicion(v_etapa_id, v_valores, null);
  exception
    when sqlstate '22023' then
      v_raised := true;
      assert sqlerrm = 'valores_invalidos', format('BLOCK 4: expected valores_invalidos, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 4: a payload missing a centro must raise 22023';

  -- Out of range (101).
  v_valores := jsonb_build_object(
    'estructura_general', 50,
    'centros', (
      select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', v))
        from (
          select c, case when row_number() over () = 1 then 101 else 50 end as v
            from unnest(v_centro_ids) as c
        ) sub
    )
  );

  v_raised := false;
  begin
    perform public.registrar_medicion(v_etapa_id, v_valores, null);
  exception
    when sqlstate '22023' then v_raised := true;
  end;
  assert v_raised, 'BLOCK 4: a value of 101 must raise 22023';

  -- Decimal (5.5).
  v_valores := jsonb_build_object(
    'estructura_general', 5.5,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 50)) from unnest(v_centro_ids) as c)
  );

  v_raised := false;
  begin
    perform public.registrar_medicion(v_etapa_id, v_valores, null);
  exception
    when sqlstate '22023' then v_raised := true;
  end;
  assert v_raised, 'BLOCK 4: estructura_general = 5.5 must raise 22023 (trunc rejects decimals)';

  select count(*) into v_medicion_count from public.mediciones_estructura where etapa_id = v_etapa_id;
  assert v_medicion_count = 0, 'BLOCK 4: no medición row must exist after any 22023 rejection';

  -- Stale p_medicion_previa_id -> PT409 (never 40001: PostgREST retries
  -- serialization_failure forever — MED-007).
  v_valores := jsonb_build_object(
    'estructura_general', 50,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 50)) from unnest(v_centro_ids) as c)
  );

  perform public.registrar_medicion(v_etapa_id, v_valores, null);

  v_raised := false;
  begin
    -- Passing null again claims "no mediciones yet", which is now false.
    perform public.registrar_medicion(v_etapa_id, v_valores, null);
  exception
    when sqlstate 'PT409' then
      v_raised := true;
      assert sqlerrm = 'conflicto_medicion', format('BLOCK 4: expected conflicto_medicion, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 4: a stale p_medicion_previa_id must raise PT409';

  select count(*) into v_medicion_count from public.mediciones_estructura where etapa_id = v_etapa_id;
  assert v_medicion_count = 1, 'BLOCK 4: the PT409 rejection must not have inserted a second row';

  raise notice 'BLOCK 4 PASSED: missing/out-of-range/decimal values raise 22023, stale previous id raises PT409, nothing persisted on failure';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 5 — registrar_medicion guards: unstarted/closed etapa, admin without
-- assignment (R10 — no admin disjunct on the write path)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_admin_user     uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_admin_role     uuid;
  v_activo_estado  uuid;
  v_pendiente_etapa uuid;
  v_activa_etapa   uuid;
  v_finalizada_etapa uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
  v_etapa_sin_iniciar uuid;
  v_etapa_cerrada  uuid;
  v_etapa_activa_id uuid;
  v_centro_ids     uuid[];
  v_valores        jsonb;
  v_raised         boolean;
begin
  raise notice '--- BLOCK 5: registrar_medicion guards (etapa_no_iniciada/etapa_cerrada/admin sin asignación) ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_pendiente_etapa from public.estados_etapa where codigo = 'pendiente';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_finalizada_etapa from public.estados_etapa where codigo = 'finalizada';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b5-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b5-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B5', '1990-01-01', 'me-b5-paciente@example.test', '+541155561004', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  -- Etapa sin iniciar (fecha_inicio null).
  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, null, v_pendiente_etapa
  ) returning id into v_etapa_sin_iniciar;

  -- La etapa activa (para el chequeo de admin sin asignación) NO se inserta acá:
  -- un paciente tiene una sola etapa abierta (seguridadPanel / SEG-006,
  -- etapas_tratamiento_una_abierta_por_paciente_idx). Más abajo, después de
  -- probar etapa_no_iniciada, esta misma etapa arranca y pasa a ser la activa.

  -- Etapa cerrada.
  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id,
    fecha_inicio, fecha_finalizacion, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id,
    public.hoy() - 60, public.hoy() - 1, v_finalizada_etapa
  ) returning id into v_etapa_cerrada;

  v_valores := jsonb_build_object(
    'estructura_general', 50,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 50)) from unnest(v_centro_ids) as c)
  );

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  v_raised := false;
  begin
    perform public.registrar_medicion(v_etapa_sin_iniciar, v_valores, null);
  exception
    when sqlstate 'P0001' then
      v_raised := true;
      assert sqlerrm = 'etapa_no_iniciada', format('BLOCK 5: expected etapa_no_iniciada, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 5: registrar_medicion on an unstarted etapa must raise etapa_no_iniciada';

  -- La etapa sin iniciar arranca: desde acá es la etapa activa del paciente.
  update public.etapas_tratamiento
     set fecha_inicio = public.hoy() - 5,
         estado_id    = v_activa_etapa
   where id = v_etapa_sin_iniciar;
  v_etapa_activa_id := v_etapa_sin_iniciar;

  v_raised := false;
  begin
    perform public.registrar_medicion(v_etapa_cerrada, v_valores, null);
  exception
    when sqlstate 'P0001' then
      v_raised := true;
      assert sqlerrm = 'etapa_cerrada', format('BLOCK 5: expected etapa_cerrada, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 5: registrar_medicion on a closed etapa must raise etapa_cerrada';

  -- R10 — admin WITHOUT assignment must be rejected, no admin disjunct here.
  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);

  v_raised := false;
  begin
    perform public.registrar_medicion(v_etapa_activa_id, v_valores, null);
  exception
    when insufficient_privilege then
      v_raised := true;
      assert sqlerrm = 'no_autorizado', format('BLOCK 5: expected no_autorizado, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 5 (R10): admin without assignment must be rejected on registrar_medicion — no admin disjunct';

  raise notice 'BLOCK 5 PASSED: etapa_no_iniciada/etapa_cerrada guards hold, admin sin asignación rejected (R10)';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6 (T0.4) — editar_medicion: the 4-condition rule, all 4 rejection
-- branches plus the happy path
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_autor_user      uuid := gen_random_uuid();
  v_otro_user       uuid := gen_random_uuid();
  v_terapeuta_role  uuid;
  v_activo_estado   uuid;
  v_activa_etapa    uuid;
  v_finalizada_etapa uuid;
  v_causa_id        uuid;
  v_algoritmo_id    uuid;
  v_modalidad_id    uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id     uuid;
  v_etapa1_id       uuid;
  v_etapa1b_id      uuid;
  v_etapa2_id       uuid;
  v_centro_ids      uuid[];
  v_valores         jsonb;
  v_valores_editados jsonb;
  v_medicion1_id    uuid;
  v_medicion2_id    uuid;
  v_medicion3_id    uuid;
  v_medicion_cierre_auto uuid;
  v_raised          boolean;
  v_audit_count     int;
  v_nuevo_valor     int;
begin
  raise notice '--- BLOCK 6 (T0.4): editar_medicion 4-condition rule ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_finalizada_etapa from public.estados_etapa where codigo = 'finalizada';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_autor_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b6-autor@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_otro_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b6-otro@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id in (v_autor_user, v_otro_user);
  insert into public.terapeutas (id) values (v_autor_user), (v_otro_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B6', '1990-01-01', 'me-b6-paciente@example.test', '+541155561005', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_autor_user, public.hoy() - 60);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_autor_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 40, v_activa_etapa
  ) returning id into v_etapa1_id;

  v_valores := jsonb_build_object(
    'estructura_general', 50,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 50)) from unnest(v_centro_ids) as c)
  );

  perform set_config('request.jwt.claim.sub', v_autor_user::text, true);

  v_medicion1_id := public.registrar_medicion(v_etapa1_id, v_valores, null);
  -- backdate: keep an explicit, unambiguous ordering across mediciones
  -- created inside this one transaction (see file header gotcha).
  update public.mediciones_estructura set registrada_en = now() - interval '2 days' where id = v_medicion1_id;

  v_medicion2_id := public.registrar_medicion(v_etapa1_id, v_valores, v_medicion1_id);
  update public.mediciones_estructura set registrada_en = now() - interval '1 day' where id = v_medicion2_id;

  v_valores_editados := jsonb_build_object(
    'estructura_general', 65,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 65)) from unnest(v_centro_ids) as c)
  );

  -- Happy path: the author edits the latest medición.
  perform public.editar_medicion(v_medicion2_id, v_valores_editados);

  select estructura_general into v_nuevo_valor from public.mediciones_estructura where id = v_medicion2_id;
  assert v_nuevo_valor = 65, format('BLOCK 6: expected estructura_general = 65 after edit, got %s', v_nuevo_valor);

  select count(*) into v_audit_count
    from public.audit_log
   where tabla = 'mediciones_estructura' and registro_id = v_medicion2_id::text and operacion = 'UPDATE';
  assert v_audit_count = 1, format('BLOCK 6: expected exactly 1 audit_log row for the edit, found %s', v_audit_count);

  -- Rejection: no_es_ultima — editing the superseded medicion1.
  v_raised := false;
  begin
    perform public.editar_medicion(v_medicion1_id, v_valores_editados);
  exception
    when insufficient_privilege then
      v_raised := true;
      assert sqlerrm = 'medicion_no_editable', format('BLOCK 6: expected medicion_no_editable, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 6: editing a superseded (not-latest) medición must raise medicion_no_editable/no_es_ultima';

  -- Rejection: otro_terapeuta.
  perform set_config('request.jwt.claim.sub', v_otro_user::text, true);

  v_raised := false;
  begin
    perform public.editar_medicion(v_medicion2_id, v_valores_editados);
  exception
    when insufficient_privilege then v_raised := true;
  end;
  assert v_raised, 'BLOCK 6: a different therapist editing someone else''s medición must raise medicion_no_editable/otro_terapeuta';

  -- Rejection: automatica — cierre_automatico is never editable, even by the
  -- "author" (registrada_por is null on those rows, so es_propia is false
  -- for everyone, but the automatica branch must win regardless).
  perform set_config('request.jwt.claim.sub', v_autor_user::text, true);

  insert into public.mediciones_estructura (etapa_id, momento, estructura_general, registrada_por, copiada_de)
  values (v_etapa1_id, 'cierre_automatico', 65, null, v_medicion2_id)
  returning id into v_medicion_cierre_auto;
  update public.mediciones_estructura set registrada_en = now() where id = v_medicion_cierre_auto;

  v_raised := false;
  begin
    perform public.editar_medicion(v_medicion_cierre_auto, v_valores_editados);
  exception
    when insufficient_privilege then v_raised := true;
  end;
  assert v_raised, 'BLOCK 6: cierre_automatico must never be editable';

  -- Rejection: etapa_posterior_iniciada — isolated from the other 3
  -- conditions on purpose. A FRESH medición (medicion3) on a FRESH etapa
  -- (etapa1b) is the latest of its own etapa, authored by the caller, with
  -- the caller's assignment still active — every other _medicion_editable
  -- condition holds. The only thing that flips it to non-editable is etapa2
  -- (created after it, and started) belonging to the same paciente.
  -- Un paciente tiene una sola etapa abierta (seguridadPanel / SEG-006): etapa1
  -- se cierra antes de abrir la siguiente. _medicion_editable no mira si la
  -- etapa de la medición está cerrada, así que las condiciones que prueba este
  -- bloque no cambian.
  update public.etapas_tratamiento
     set fecha_finalizacion = public.hoy() - 5,
         estado_id          = (select id from public.estados_etapa where codigo = 'finalizada')
   where id = v_etapa1_id;

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_autor_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 5, v_activa_etapa
  ) returning id into v_etapa1b_id;

  v_medicion3_id := public.registrar_medicion(v_etapa1b_id, v_valores, null);

  -- Still editable before any later etapa exists — pins the "every other
  -- condition holds" precondition before flipping it.
  perform public.editar_medicion(v_medicion3_id, v_valores_editados);

  -- Un paciente tiene una sola etapa abierta (seguridadPanel / SEG-006): etapa1b
  -- se cierra antes de abrir la siguiente. _medicion_editable no mira si la
  -- etapa de la medición está cerrada, así que las condiciones que prueba este
  -- bloque no cambian.
  update public.etapas_tratamiento
     set fecha_finalizacion = public.hoy() - 1,
         estado_id          = (select id from public.estados_etapa where codigo = 'finalizada')
   where id = v_etapa1b_id;

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_autor_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 1, v_activa_etapa
  ) returning id into v_etapa2_id;

  v_raised := false;
  begin
    perform public.editar_medicion(v_medicion3_id, v_valores_editados);
  exception
    when insufficient_privilege then v_raised := true;
  end;
  assert v_raised,
    'BLOCK 6: once a later etapa of the same paciente has started, an otherwise-editable medición must be rejected (etapa_posterior_iniciada)';

  raise notice 'BLOCK 6 PASSED: author edits the latest medición (audited); superseded/foreign-author/cierre_automatico/etapa_posterior_iniciada all rejected';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 7 (T0.3) — get_estructura_paciente: unauthorized rejected, admin
-- without assignment gets a read-only envelope
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_asignado uuid := gen_random_uuid();
  v_admin_user         uuid := gen_random_uuid();
  v_ajeno_user         uuid := gen_random_uuid();
  v_terapeuta_role     uuid;
  v_admin_role         uuid;
  v_activo_estado      uuid;
  v_activa_etapa       uuid;
  v_causa_id           uuid;
  v_algoritmo_id       uuid;
  v_modalidad_id       uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id        uuid;
  v_etapa_id           uuid;
  v_resultado          jsonb;
  v_raised             boolean;
begin
  raise notice '--- BLOCK 7 (T0.3): get_estructura_paciente authz + envelope ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_terapeuta_asignado, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b7-asignado@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b7-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_ajeno_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b7-ajeno@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id in (v_terapeuta_asignado, v_ajeno_user);
  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  insert into public.terapeutas (id) values (v_terapeuta_asignado), (v_ajeno_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B7', '1990-01-01', 'me-b7-paciente@example.test', '+541155561006', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_asignado, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_asignado, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 10, v_activa_etapa
  ) returning id into v_etapa_id;

  -- Unauthorized: therapist with no assignment, not admin.
  perform set_config('request.jwt.claim.sub', v_ajeno_user::text, true);

  v_raised := false;
  begin
    perform public.get_estructura_paciente(v_paciente_id);
  exception
    when insufficient_privilege then v_raised := true;
  end;
  assert v_raised, 'BLOCK 7: get_estructura_paciente must raise 42501 for a caller with no assignment and no admin role';

  -- Admin without assignment: read succeeds, read-only envelope.
  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);

  v_resultado := public.get_estructura_paciente(v_paciente_id);

  assert (v_resultado ->> 'puede_medir')::boolean = false,
    'BLOCK 7: admin without assignment must get puede_medir = false';
  assert (v_resultado ->> 'es_admin')::boolean = true,
    'BLOCK 7: admin without assignment must get es_admin = true';
  assert (v_resultado ->> 'paciente_id')::uuid = v_paciente_id,
    'BLOCK 7: paciente_id in the envelope must echo the argument';
  assert jsonb_array_length(v_resultado -> 'centros_activos') = 12,
    'BLOCK 7: centros_activos must list the 12 active centros';

  -- Assigned therapist: full read/write envelope.
  perform set_config('request.jwt.claim.sub', v_terapeuta_asignado::text, true);

  v_resultado := public.get_estructura_paciente(v_paciente_id);

  assert (v_resultado ->> 'puede_medir')::boolean = true,
    'BLOCK 7: assigned therapist must get puede_medir = true';
  assert (v_resultado ->> 'es_admin')::boolean = false,
    'BLOCK 7: assigned therapist (non-admin) must get es_admin = false';

  raise notice 'BLOCK 7 PASSED: unauthorized rejected, admin sin asignación read-only, assigned therapist full envelope';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 8 (T0.5) — cerrar_etapa_con_medicion: atomic close, invalid values
-- leave the etapa open, admin without assignment rejected
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user  uuid := gen_random_uuid();
  v_admin_user      uuid := gen_random_uuid();
  v_terapeuta_role  uuid;
  v_admin_role      uuid;
  v_activo_estado   uuid;
  v_activa_etapa    uuid;
  v_causa_id        uuid;
  v_algoritmo_id    uuid;
  v_modalidad_id    uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id     uuid;
  v_etapa_id        uuid;
  v_centro_ids      uuid[];
  v_valores         jsonb;
  v_valores_invalidos jsonb;
  v_cierre_id       uuid;
  v_estado_id       uuid;
  v_estado_final    text;
  v_medicion_count  int;
  v_raised          boolean;
begin
  raise notice '--- BLOCK 8 (T0.5): cerrar_etapa_con_medicion ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b8-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b8-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B8', '1990-01-01', 'me-b8-paciente@example.test', '+541155561007', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 30, v_activa_etapa
  ) returning id into v_etapa_id;

  v_valores := jsonb_build_object(
    'estructura_general', 80,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 80)) from unnest(v_centro_ids) as c)
  );

  -- Admin without assignment must be rejected FIRST (before any mutation
  -- attempt), same disjunct-free rule as registrar_medicion.
  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);

  v_raised := false;
  begin
    perform public.cerrar_etapa_con_medicion(v_paciente_id, null, v_valores, null);
  exception
    when insufficient_privilege then v_raised := true;
  end;
  assert v_raised, 'BLOCK 8: admin without assignment must be rejected on cerrar_etapa_con_medicion';

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  -- Invalid values leave the etapa open.
  v_valores_invalidos := jsonb_build_object(
    'estructura_general', 200,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 80)) from unnest(v_centro_ids) as c)
  );

  v_raised := false;
  begin
    perform public.cerrar_etapa_con_medicion(v_paciente_id, null, v_valores_invalidos, null);
  exception
    when sqlstate '22023' then v_raised := true;
  end;
  assert v_raised, 'BLOCK 8: out-of-range values must raise 22023';

  select fecha_finalizacion is null into v_raised from public.etapas_tratamiento where id = v_etapa_id;
  assert v_raised, 'BLOCK 8: the etapa must stay open after a 22023 rejection';

  select count(*) into v_medicion_count from public.mediciones_estructura where etapa_id = v_etapa_id;
  assert v_medicion_count = 0, 'BLOCK 8: no medición row must exist after the 22023 rejection';

  -- Stale p_medicion_previa_id -> PT409 (MED-007), etapa stays open.
  v_raised := false;
  begin
    perform public.cerrar_etapa_con_medicion(v_paciente_id, null, v_valores, gen_random_uuid());
  exception
    when sqlstate 'PT409' then
      v_raised := true;
      assert sqlerrm = 'conflicto_medicion', format('BLOCK 8: expected conflicto_medicion, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 8: a stale p_medicion_previa_id must raise PT409';

  select fecha_finalizacion is null into v_raised from public.etapas_tratamiento where id = v_etapa_id;
  assert v_raised, 'BLOCK 8: the etapa must stay open after a PT409 rejection';

  -- Atomic close with valid values.
  v_cierre_id := public.cerrar_etapa_con_medicion(v_paciente_id, 'Tratamiento completo', v_valores, null);

  select estado_id into v_estado_id from public.etapas_tratamiento where id = v_etapa_id;
  select ee.codigo into v_estado_final from public.estados_etapa ee where ee.id = v_estado_id;
  assert v_estado_final = 'finalizada', format('BLOCK 8: expected etapa finalizada, got %L', v_estado_final);

  select count(*) into v_medicion_count
    from public.mediciones_estructura where etapa_id = v_etapa_id and momento = 'cierre';
  assert v_medicion_count = 1, format('BLOCK 8: expected exactly 1 cierre medición, found %s', v_medicion_count);

  assert v_cierre_id is not null, 'BLOCK 8: cerrar_etapa_con_medicion must return the cierre medición id';

  raise notice 'BLOCK 8 PASSED: admin sin asignación rechazado, valores inválidos y previa stale (PT409) dejan la etapa abierta, cierre atómico exitoso';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 9 — cierre_automatico integrity: zero prior mediciones -> no row at
-- all, even on a path that would otherwise generate one
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_admin_user     uuid := gen_random_uuid();
  v_terapeuta_user uuid := gen_random_uuid();
  v_admin_role     uuid;
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_medicion_count int;
begin
  raise notice '--- BLOCK 9: cierre_automatico integrity — zero mediciones means zero rows ---';

  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b9-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b9-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B9', '1990-01-01', 'me-b9-paciente@example.test', '+541155561008', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 30, v_activa_etapa
  ) returning id into v_etapa_id;

  -- Admin closes as finalizada without assignment — the DEC-33 guard never
  -- fires for an admin (has_active_assignment is false for them), so this
  -- reaches _generar_cierre_automatico. With zero prior mediciones it must
  -- be a true no-op.
  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);
  perform public.cerrar_etapa(v_paciente_id, 'finalizada', null);

  select count(*) into v_medicion_count from public.mediciones_estructura where etapa_id = v_etapa_id;
  assert v_medicion_count = 0,
    format('BLOCK 9: expected zero mediciones for an etapa with no prior readings, found %s', v_medicion_count);

  raise notice 'BLOCK 9 PASSED: closing an etapa with zero prior mediciones generates no cierre_automatico row';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 10 — cerrar_etapa: DEC-31/DEC-33 authorization + conditional guard
-- matrix
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_asignado_user     uuid := gen_random_uuid();
  v_admin_user        uuid := gen_random_uuid();
  v_terapeuta_role    uuid;
  v_admin_role        uuid;
  v_activo_estado     uuid;
  v_activa_etapa      uuid;
  v_pendiente_etapa   uuid;
  v_causa_id          uuid;
  v_algoritmo_id      uuid;
  v_modalidad_id      uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente1_id      uuid;
  v_paciente2_id      uuid;
  v_paciente3_id      uuid;
  v_etapa1_id         uuid;
  v_etapa2_id         uuid;
  v_etapa3_id         uuid;
  v_centro_ids        uuid[];
  v_valores           jsonb;
  v_raised            boolean;
  v_estado_final      text;
begin
  raise notice '--- BLOCK 10: cerrar_etapa DEC-31/DEC-33 matrix ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_pendiente_etapa from public.estados_etapa where codigo = 'pendiente';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_asignado_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b10-asignado@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b10-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id = v_asignado_user;
  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  insert into public.terapeutas (id) values (v_asignado_user);

  -- Paciente 1: etapa arrancada, con historial -> el asignado debe usar
  -- cerrar_etapa_con_medicion.
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B10-1', '1990-01-01', 'me-b10-1@example.test', '+541155561009', v_activo_estado, true)
  returning id into v_paciente1_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente1_id, v_asignado_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente1_id, v_asignado_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 30, v_activa_etapa
  ) returning id into v_etapa1_id;

  v_valores := jsonb_build_object(
    'estructura_general', 50,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 50)) from unnest(v_centro_ids) as c)
  );

  perform set_config('request.jwt.claim.sub', v_asignado_user::text, true);
  perform public.registrar_medicion(v_etapa1_id, v_valores, null);

  v_raised := false;
  begin
    perform public.cerrar_etapa(v_paciente1_id, 'finalizada', null);
  exception
    when sqlstate 'P0001' then
      v_raised := true;
      assert sqlerrm = 'medicion_cierre_requerida',
        format('BLOCK 10: expected medicion_cierre_requerida, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 10: assignee on a started etapa with history must be blocked by medicion_cierre_requerida';

  -- Paciente 2: mismo escenario, pero ADMIN sin asignación cierra sin bloqueo
  -- y genera cierre_automatico (tiene historial).
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B10-2', '1990-01-01', 'me-b10-2@example.test', '+541155561010', v_activo_estado, true)
  returning id into v_paciente2_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente2_id, v_asignado_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente2_id, v_asignado_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 30, v_activa_etapa
  ) returning id into v_etapa2_id;

  perform public.registrar_medicion(v_etapa2_id, v_valores, null);

  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);
  perform public.cerrar_etapa(v_paciente2_id, 'finalizada', null);

  select ee.codigo into v_estado_final
    from public.etapas_tratamiento et join public.estados_etapa ee on ee.id = et.estado_id
   where et.id = v_etapa2_id;
  assert v_estado_final = 'finalizada',
    format('BLOCK 10: admin sin asignación debe poder cerrar finalizada sin bloqueo, got %L', v_estado_final);

  assert exists (
    select 1 from public.mediciones_estructura
     where etapa_id = v_etapa2_id and momento = 'cierre_automatico'
  ), 'BLOCK 10: closing with history via the admin path must generate a cierre_automatico row';

  -- Paciente 3: etapa SIN arrancar -> el asignado cierra 'finalizada' sin
  -- exigir medición (fuera de alcance, DevSpec §17).
  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B10-3', '1990-01-01', 'me-b10-3@example.test', '+541155561011', v_activo_estado, true)
  returning id into v_paciente3_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente3_id, v_asignado_user, public.hoy() - 5);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente3_id, v_asignado_user, v_causa_id, v_algoritmo_id, v_modalidad_id, null, v_pendiente_etapa
  ) returning id into v_etapa3_id;

  perform set_config('request.jwt.claim.sub', v_asignado_user::text, true);
  perform public.cerrar_etapa(v_paciente3_id, 'finalizada', null);

  select ee.codigo into v_estado_final
    from public.etapas_tratamiento et join public.estados_etapa ee on ee.id = et.estado_id
   where et.id = v_etapa3_id;
  assert v_estado_final = 'finalizada',
    'BLOCK 10: assignee closing an unstarted etapa as finalizada must succeed without a medición guard';

  -- abandonada never raises the DEC-33 guard, even for the assignee. Se usa la
  -- etapa del Paciente 1 que quedó abierta más arriba (arrancada, con
  -- historial: el caso que 'finalizada' bloquea). Antes se insertaba una
  -- segunda etapa abierta, que ya no puede existir (seguridadPanel / SEG-006).
  perform public.cerrar_etapa(v_paciente1_id, 'abandonada', null);

  select ee.codigo into v_estado_final
    from public.etapas_tratamiento et join public.estados_etapa ee on ee.id = et.estado_id
   where et.id = v_etapa1_id;
  assert v_estado_final = 'abandonada', 'BLOCK 10: closing as abandonada must never raise medicion_cierre_requerida';

  raise notice 'BLOCK 10 PASSED: DEC-31/DEC-33 matrix holds — assignee blocked with history, admin closes freely, unstarted/abandonada never guarded';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 11 — cierre_automatico row shape: registrada_por null, copiada_de set
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_asignado_user  uuid := gen_random_uuid();
  v_admin_user     uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_admin_role     uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_centro_ids     uuid[];
  v_valores        jsonb;
  v_ultima_id      uuid;
  v_auto_row       record;
begin
  raise notice '--- BLOCK 11: cierre_automatico row shape (registrada_por null, copiada_de set) ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_admin_role from public.roles where codigo = 'admin';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_asignado_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b11-asignado@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_admin_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b11-admin@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id = v_asignado_user;
  update public.profiles set rol_id = v_admin_role where id = v_admin_user;
  insert into public.terapeutas (id) values (v_asignado_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B11', '1990-01-01', 'me-b11-paciente@example.test', '+541155561012', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_asignado_user, public.hoy() - 30);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_asignado_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 30, v_activa_etapa
  ) returning id into v_etapa_id;

  v_valores := jsonb_build_object(
    'estructura_general', 55,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 55)) from unnest(v_centro_ids) as c)
  );

  perform set_config('request.jwt.claim.sub', v_asignado_user::text, true);
  v_ultima_id := public.registrar_medicion(v_etapa_id, v_valores, null);

  perform set_config('request.jwt.claim.sub', v_admin_user::text, true);
  perform public.cerrar_etapa(v_paciente_id, 'finalizada', null);

  select registrada_por, copiada_de, estructura_general into v_auto_row
    from public.mediciones_estructura
   where etapa_id = v_etapa_id and momento = 'cierre_automatico';

  assert v_auto_row.registrada_por is null, 'BLOCK 11: cierre_automatico must have registrada_por = null';
  assert v_auto_row.copiada_de = v_ultima_id,
    format('BLOCK 11: expected copiada_de = %s, got %s', v_ultima_id, v_auto_row.copiada_de);
  assert v_auto_row.estructura_general = 55,
    format('BLOCK 11: expected cloned estructura_general = 55, got %s', v_auto_row.estructura_general);

  assert (
    select count(*) from public.medicion_valores mv
     where mv.medicion_id = (
       select id from public.mediciones_estructura where etapa_id = v_etapa_id and momento = 'cierre_automatico'
     )
  ) = 12, 'BLOCK 11: cierre_automatico must clone all 12 medicion_valores rows';

  raise notice 'BLOCK 11 PASSED: cierre_automatico clones the last medición (registrada_por null, copiada_de set, full detail)';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 12 (R5) — baja_voluntaria_paciente: the for-loop hook covers EVERY
-- open etapa, not just the first (the pre-existing update has no limit 1)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- La anomalía que arma este bloque (dos etapas abiertas a la vez) ya no se
-- puede insertar: seguridadPanel / SEG-006 la prohíbe con un índice único. El
-- loop de la baja sigue sin `limit 1` como defensa, así que para probarlo el
-- índice se saca SOLO dentro de esta transacción; el rollback lo restaura.
drop index public.etapas_tratamiento_una_abierta_por_paciente_idx;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_paciente_user  uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_paciente_id    uuid;
  v_etapa_a        uuid;
  v_etapa_b        uuid;
  v_centro_ids     uuid[];
  v_valores        jsonb;
begin
  raise notice '--- BLOCK 12 (R5): baja_voluntaria_paciente closes ALL open etapas with cierre_automatico ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select array_agg(id order by orden) into v_centro_ids from public.centros_energeticos where activo;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
  (v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b12-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  (v_paciente_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'me-b12-paciente@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo, user_id)
  values ('Paciente B12', '1990-01-01', 'me-b12-paciente@example.test', '+541155561013', v_activo_estado, true, v_paciente_user)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  -- Data anomaly on purpose (per design R5): two simultaneously open etapas
  -- for the same paciente, each with its own medición history.
  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 30, v_activa_etapa
  ) returning id into v_etapa_a;

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, public.hoy() - 20, v_activa_etapa
  ) returning id into v_etapa_b;

  v_valores := jsonb_build_object(
    'estructura_general', 40,
    'centros', (select jsonb_agg(jsonb_build_object('centro_id', c, 'valor', 40)) from unnest(v_centro_ids) as c)
  );

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);
  perform public.registrar_medicion(v_etapa_a, v_valores, null);
  perform public.registrar_medicion(v_etapa_b, v_valores, null);

  perform public.baja_voluntaria_paciente(v_paciente_user);

  assert exists (
    select 1 from public.mediciones_estructura where etapa_id = v_etapa_a and momento = 'cierre_automatico'
  ), 'BLOCK 12 (R5): etapa A must have received its cierre_automatico';

  assert exists (
    select 1 from public.mediciones_estructura where etapa_id = v_etapa_b and momento = 'cierre_automatico'
  ), 'BLOCK 12 (R5): etapa B must ALSO have received its cierre_automatico — the for loop must not stop at the first row (no limit 1 on the pre-existing update)';

  assert (select count(*) from public.etapas_tratamiento where paciente_id = v_paciente_id and fecha_finalizacion is null) = 0,
    'BLOCK 12: both etapas must be closed after baja_voluntaria_paciente';

  raise notice 'BLOCK 12 (R5) PASSED: baja_voluntaria_paciente generates cierre_automatico for every open etapa, not just the first';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 13 (DEC-32) — marcar_alerta_atendida: catalog-driven, fail-closed
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_paciente_id    uuid;
  v_raised         boolean;
begin
  raise notice '--- BLOCK 13 (DEC-32): marcar_alerta_atendida catalog lookup ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'me-b13-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B13', '1990-01-01', 'me-b13-paciente@example.test', '+541155561014', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, public.hoy() - 30);

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);

  -- The 5 pre-existing types still work.
  perform public.marcar_alerta_atendida('score_bajo', 'evt-1', v_paciente_id);
  perform public.marcar_alerta_atendida('eval_vencida', 'evt-2', v_paciente_id);
  perform public.marcar_alerta_atendida('mes_3', 'evt-3', v_paciente_id);
  perform public.marcar_alerta_atendida('fin', 'evt-4', v_paciente_id);
  perform public.marcar_alerta_atendida('reinicio', 'evt-5', v_paciente_id);

  assert (select count(*) from public.alertas_atendidas where paciente_id = v_paciente_id) = 5,
    'BLOCK 13: the 5 pre-existing descartable types must all succeed';

  -- medicion_cierre_pendiente is NOT descartable.
  v_raised := false;
  begin
    perform public.marcar_alerta_atendida('medicion_cierre_pendiente', 'evt-6', v_paciente_id);
  exception
    when sqlstate '23514' then
      v_raised := true;
      assert sqlerrm = 'tipo_invalido', format('BLOCK 13: expected tipo_invalido, got %L', sqlerrm);
  end;
  assert v_raised, 'BLOCK 13: medicion_cierre_pendiente must be rejected as tipo_invalido (descartable = false)';

  -- Unknown codigo fails closed.
  v_raised := false;
  begin
    perform public.marcar_alerta_atendida('no_existe', 'evt-7', v_paciente_id);
  exception
    when sqlstate '23514' then v_raised := true;
  end;
  assert v_raised, 'BLOCK 13: an unknown p_tipo must fail closed (coalesce(..., false))';

  raise notice 'BLOCK 13 PASSED: catalog-driven dismissibility — 5 existing types work, medicion_cierre_pendiente and unknown codes rejected';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 14 — derive_alertas_activas: medicion_cierre_pendiente appears then
-- clears on close
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_terapeuta_user uuid := gen_random_uuid();
  v_terapeuta_role uuid;
  v_activo_estado  uuid;
  v_activa_etapa   uuid;
  v_causa_id       uuid;
  v_algoritmo_id   uuid;
  v_modalidad_id   uuid := 'b2000002-0000-0000-0000-000000000000';
  v_cantidad_niveles int;
  v_paciente_id    uuid;
  v_etapa_id       uuid;
  v_fecha_inicio   date;
  v_existe         boolean;
begin
  raise notice '--- BLOCK 14: medicion_cierre_pendiente appears then clears on close ---';

  select id into v_terapeuta_role from public.roles where codigo = 'terapeuta';
  select id into v_activo_estado from public.estados_paciente where codigo = 'activo';
  select id into v_activa_etapa from public.estados_etapa where codigo = 'activa';
  select id into v_causa_id from public.causas limit 1;
  select id into v_algoritmo_id from public.algoritmos limit 1;
  select cantidad_niveles into v_cantidad_niveles from public.modalidades where id = v_modalidad_id;

  -- fecha_inicio such that today falls exactly on/after the last week
  -- (semanas_de_etapa = cantidad_niveles * 4; last week starts at
  -- fecha_inicio + (semanas - 1) * 7).
  v_fecha_inicio := public.hoy() - ((v_cantidad_niveles * 4 - 1) * 7 + 1);

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    v_terapeuta_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'me-b14-terapeuta@example.test', crypt('test1234', gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  update public.profiles set rol_id = v_terapeuta_role where id = v_terapeuta_user;
  insert into public.terapeutas (id) values (v_terapeuta_user);

  insert into public.pacientes (nombre, fecha_nacimiento, email, telefono, estado_id, activo)
  values ('Paciente B14', '1990-01-01', 'me-b14-paciente@example.test', '+541155561015', v_activo_estado, true)
  returning id into v_paciente_id;

  insert into public.asignaciones_paciente (paciente_id, terapeuta_id, fecha_desde)
  values (v_paciente_id, v_terapeuta_user, v_fecha_inicio);

  insert into public.etapas_tratamiento (
    paciente_id, terapeuta_id, causa_id, algoritmo_id, modalidad_id, fecha_inicio, estado_id
  ) values (
    v_paciente_id, v_terapeuta_user, v_causa_id, v_algoritmo_id, v_modalidad_id, v_fecha_inicio, v_activa_etapa
  ) returning id into v_etapa_id;

  select exists (
    select 1 from public.derive_alertas_activas()
     where paciente_id = v_paciente_id and tipo = 'medicion_cierre_pendiente'
  ) into v_existe;
  assert v_existe, 'BLOCK 14: an etapa in its last content week must fire medicion_cierre_pendiente';

  perform set_config('request.jwt.claim.sub', v_terapeuta_user::text, true);
  perform public.cerrar_etapa(v_paciente_id, 'abandonada', null);

  select exists (
    select 1 from public.derive_alertas_activas()
     where paciente_id = v_paciente_id and tipo = 'medicion_cierre_pendiente'
  ) into v_existe;
  assert not v_existe, 'BLOCK 14: medicion_cierre_pendiente must clear once the etapa closes';

  raise notice 'BLOCK 14 PASSED: medicion_cierre_pendiente fires in the last content week and clears on close';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 16 (design §2.5) — EXECUTE privilege assert over the exhaustive
-- 13-row `create or replace` inventory. This is the R0/R3 net: every
-- function this change creates or replaces must land in the correct
-- grant/revoke bucket, and it must survive a future `create or replace`
-- regression the same way.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_fn   text;
  v_priv boolean;
begin
  raise notice '--- BLOCK 16 (design §2.5): EXECUTE privilege allowlist ---';

  -- Private — must NOT be executable by authenticated.
  foreach v_fn in array array[
    'public._validar_valores_medicion(jsonb, uuid[])',
    'public._medicion_editable(uuid)',
    'public._insertar_medicion(uuid, text, jsonb)',
    'public._generar_cierre_automatico(uuid)',
    'public.derive_alertas_activas()',
    'public.semanas_de_etapa(uuid)',
    'public.baja_voluntaria_paciente(uuid)'
  ]
  loop
    select has_function_privilege('authenticated', v_fn, 'execute') into v_priv;
    assert v_priv = false, format('BLOCK 16: %s must NOT be executable by authenticated', v_fn);
  end loop;

  -- baja_voluntaria_paciente is service_role-only — the R0 regression net.
  select has_function_privilege('service_role', 'public.baja_voluntaria_paciente(uuid)', 'execute') into v_priv;
  assert v_priv = true, 'BLOCK 16 (R0): service_role must be able to execute baja_voluntaria_paciente';

  -- Public — must be executable by authenticated.
  foreach v_fn in array array[
    'public.get_estructura_paciente(uuid)',
    'public.registrar_medicion(uuid, jsonb, uuid)',
    'public.editar_medicion(uuid, jsonb)',
    'public.cerrar_etapa_con_medicion(uuid, text, jsonb, uuid)',
    'public.cerrar_etapa(uuid, text, text)',
    'public.marcar_alerta_atendida(text, text, uuid)'
  ]
  loop
    select has_function_privilege('authenticated', v_fn, 'execute') into v_priv;
    assert v_priv = true, format('BLOCK 16: %s MUST be executable by authenticated', v_fn);
  end loop;

  raise notice 'BLOCK 16 PASSED: all 13 create-or-replace targets land in the correct grant/revoke bucket';
end;
$$;

rollback;
