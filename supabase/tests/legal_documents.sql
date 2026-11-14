-- =============================================================================
-- legal_documents.sql — Assertion tests for documentos_legales +
-- aceptaciones_documentos_legales + resolver_documentos_legales_vigentes
-- =============================================================================
-- Coverage: document immutability and versioning, current version
-- resolution, acceptance record integrity, admin-only access.
--
-- TOOLING: same lightweight SQL assertion harness as supabase/tests/otp_functions.sql
-- — DO $$ ... ASSERT ... $$ blocks
-- wrapped in transactions that ROLLBACK after each group to keep the DB clean.
-- No pgTAP, no `supabase test db`.
--
-- HOW TO RUN:
--   psql "$DATABASE_URL" -f supabase/tests/legal_documents.sql
--
-- PREREQUISITES:
--   - The schema in supabase/schemas/ has been applied (documentos_legales,
--     aceptaciones_documentos_legales, resolver_documentos_legales_vigentes).
--   - Seed users exist: admin@clienteapp.test (admin), terapeuta1@clienteapp.test
--     (non-admin authenticated), per supabase/seed-credentials.md.
--   - BLOCKS 1-10 insert and roll back their own temp rows as postgres
--     (bypasses RLS) and do NOT depend on the seed migration.
--   - BLOCKS 11-13 DO depend on the real seed migration
--     (supabase/migrations/<ts>_seed_documentos_legales.sql) having run —
--     they assert against the real CONSENTIMIENTO_APP_PACIENTE/
--     TERMINOS_CONDICIONES_APP_PACIENTE 1.0 rows, not temp data.
--
-- STYLE GUIDE: .claude/sql-style-guide.md
-- =============================================================================

\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 — tipo_documento_legal enum has exactly the two expected values
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_values text;
begin
  raise notice '--- BLOCK 1: tipo_documento_legal enum values ---';

  select string_agg(enumlabel, ', ' order by enumlabel)
    into v_values
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
   where t.typname = 'tipo_documento_legal';

  assert v_values = 'CONSENTIMIENTO_APP_PACIENTE, TERMINOS_CONDICIONES_APP_PACIENTE',
    format('BLOCK 1: expected exactly the two documented enum values, got %L', v_values);

  raise notice 'BLOCK 1 PASSED: tipo_documento_legal has CONSENTIMIENTO_APP_PACIENTE and TERMINOS_CONDICIONES_APP_PACIENTE';
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 — documentos_legales: unique(tipo, version) rejects duplicates
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
begin
  raise notice '--- BLOCK 2: documentos_legales unique(tipo, version) ---';

  -- '9.9' is a throwaway test version, distinct from any real seeded version
  -- (the seed migration seeds '1.0' for both tipos) so this block stays
  -- independent of seed data and does not collide with it under
  -- unique(tipo, version).
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.9', 'Consentimiento v1', 'texto', now());

  begin
    insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
    values ('CONSENTIMIENTO_APP_PACIENTE', '9.9', 'Consentimiento v1 duplicado', 'texto2', now());

    assert false, 'BLOCK 2: duplicate (tipo, version) was accepted — unique constraint missing';
  exception
    when unique_violation then
      raise notice '  duplicate (tipo, version) correctly rejected';
  end;

  raise notice 'BLOCK 2 PASSED: unique(tipo, version) rejects duplicates';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 — documentos_legales: immutability — UPDATE/DELETE/TRUNCATE all blocked
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_id uuid;
begin
  raise notice '--- BLOCK 3: documentos_legales immutability (UPDATE/DELETE/TRUNCATE) ---';

  -- '9.9' avoids colliding with the real seeded '1.0' row.
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('TERMINOS_CONDICIONES_APP_PACIENTE', '9.9', 'Terminos v1', 'texto', now())
  returning id into v_id;

  begin
    update public.documentos_legales set titulo = 'cambiado' where id = v_id;
    assert false, 'BLOCK 3: UPDATE on documentos_legales was accepted — immutability trigger missing';
  exception
    when others then
      assert sqlerrm like '%modificacion_no_permitida%',
        format('BLOCK 3: expected modificacion_no_permitida on UPDATE, got %L', sqlerrm);
      raise notice '  UPDATE correctly rejected';
  end;

  begin
    delete from public.documentos_legales where id = v_id;
    assert false, 'BLOCK 3: DELETE on documentos_legales was accepted — immutability trigger missing';
  exception
    when others then
      assert sqlerrm like '%modificacion_no_permitida%',
        format('BLOCK 3: expected modificacion_no_permitida on DELETE, got %L', sqlerrm);
      raise notice '  DELETE correctly rejected';
  end;

  begin
    truncate public.documentos_legales;
    assert false, 'BLOCK 3: TRUNCATE on documentos_legales was accepted — immutability trigger missing';
  exception
    when others then
      -- Two independent guards protect against TRUNCATE here: Postgres itself
      -- refuses a plain TRUNCATE on a table referenced by an FK from another
      -- table (aceptaciones_documentos_legales.documento_id) before any
      -- trigger fires; rechazar_truncate_documentos_legales is what stops
      -- `truncate ... cascade`, which bypasses that structural guard. Either
      -- error means TRUNCATE is blocked.
      assert sqlerrm like '%modificacion_no_permitida%'
          or sqlerrm like '%cannot truncate a table referenced in a foreign key constraint%',
        format('BLOCK 3: expected TRUNCATE to be blocked, got %L', sqlerrm);
      raise notice '  TRUNCATE correctly rejected (%)', sqlerrm;
  end;

  begin
    truncate public.documentos_legales cascade;
    assert false, 'BLOCK 3: TRUNCATE ... CASCADE on documentos_legales was accepted — immutability trigger missing';
  exception
    when others then
      assert sqlerrm like '%modificacion_no_permitida%',
        format('BLOCK 3: expected modificacion_no_permitida on TRUNCATE CASCADE, got %L', sqlerrm);
      raise notice '  TRUNCATE CASCADE correctly rejected by rechazar_truncate_documentos_legales';
  end;

  raise notice 'BLOCK 3 PASSED: documentos_legales blocks UPDATE, DELETE and TRUNCATE';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 — aceptaciones_documentos_legales: composite FK (documento_id, tipo)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_doc_id    uuid;
  v_pac_id    uuid := 'd0000005-0000-0000-0000-000000000000'; -- v_pac5, seed
begin
  raise notice '--- BLOCK 4: aceptaciones_documentos_legales composite FK (documento_id, tipo) ---';

  -- '9.9' avoids colliding with the real seeded '1.0' row.
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.9', 'Consentimiento v1', 'texto', now())
  returning id into v_doc_id;

  -- Matching (documento_id, tipo) must be accepted.
  insert into public.aceptaciones_documentos_legales (paciente_id, user_id, documento_id, tipo)
  values (v_pac_id, null, v_doc_id, 'CONSENTIMIENTO_APP_PACIENTE');

  raise notice '  matching (documento_id, tipo) accepted';

  -- Mismatched tipo (document is CONSENTIMIENTO but claims TERMINOS) must fail
  -- the composite FK, because unique(id, tipo) on documentos_legales means
  -- (v_doc_id, TERMINOS_CONDICIONES_APP_PACIENTE) does not exist.
  begin
    insert into public.aceptaciones_documentos_legales (paciente_id, user_id, documento_id, tipo)
    values ('d0000006-0000-0000-0000-000000000000', null, v_doc_id, 'TERMINOS_CONDICIONES_APP_PACIENTE');

    assert false, 'BLOCK 4: mismatched (documento_id, tipo) was accepted — composite FK missing';
  exception
    when foreign_key_violation then
      raise notice '  mismatched (documento_id, tipo) correctly rejected by composite FK';
  end;

  raise notice 'BLOCK 4 PASSED: composite FK (documento_id, tipo) -> documentos_legales(id, tipo)';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 5 — aceptaciones_documentos_legales: unique(paciente_id, documento_id)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_doc_id uuid;
  v_pac_id uuid := 'd0000005-0000-0000-0000-000000000000';
begin
  raise notice '--- BLOCK 5: aceptaciones_documentos_legales unique(paciente_id, documento_id) ---';

  -- '9.9' avoids colliding with the real seeded '1.0' row.
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.9', 'Consentimiento v1', 'texto', now())
  returning id into v_doc_id;

  insert into public.aceptaciones_documentos_legales (paciente_id, user_id, documento_id, tipo)
  values (v_pac_id, null, v_doc_id, 'CONSENTIMIENTO_APP_PACIENTE');

  begin
    insert into public.aceptaciones_documentos_legales (paciente_id, user_id, documento_id, tipo)
    values (v_pac_id, null, v_doc_id, 'CONSENTIMIENTO_APP_PACIENTE');

    assert false, 'BLOCK 5: duplicate (paciente_id, documento_id) was accepted — unique constraint missing';
  exception
    when unique_violation then
      raise notice '  duplicate acceptance correctly rejected';
  end;

  raise notice 'BLOCK 5 PASSED: unique(paciente_id, documento_id) rejects duplicates';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6 — aceptaciones_documentos_legales: blocks UPDATE for everyone; DELETE
-- is allowed only for service_role (#256)
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_doc_id uuid;
  v_acc_id uuid;
  v_pac_id uuid := 'd0000005-0000-0000-0000-000000000000';
begin
  raise notice '--- BLOCK 6: aceptaciones_documentos_legales UPDATE blocked, DELETE service_role-only ---';

  -- '9.9' avoids colliding with the real seeded '1.0' row.
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.9', 'Consentimiento v1', 'texto', now())
  returning id into v_doc_id;

  insert into public.aceptaciones_documentos_legales (paciente_id, user_id, documento_id, tipo)
  values (v_pac_id, null, v_doc_id, 'CONSENTIMIENTO_APP_PACIENTE')
  returning id into v_acc_id;

  begin
    update public.aceptaciones_documentos_legales set aceptado_at = now() where id = v_acc_id;
    assert false, 'BLOCK 6: UPDATE on aceptaciones_documentos_legales was accepted — trigger missing';
  exception
    when others then
      assert sqlerrm like '%modificacion_no_permitida%',
        format('BLOCK 6: expected modificacion_no_permitida on UPDATE, got %L', sqlerrm);
      raise notice '  UPDATE correctly rejected';
  end;

  -- DELETE privilege check: only service_role should hold it; anon/authenticated
  -- must not (grant-level check, grant-level technique).
  assert has_table_privilege('service_role', 'public.aceptaciones_documentos_legales', 'delete'),
    'BLOCK 6: service_role must retain DELETE on aceptaciones_documentos_legales (purge-test-paciente.mjs)';
  assert not has_table_privilege('authenticated', 'public.aceptaciones_documentos_legales', 'delete'),
    'BLOCK 6: authenticated must NOT have DELETE on aceptaciones_documentos_legales';
  assert not has_table_privilege('anon', 'public.aceptaciones_documentos_legales', 'delete'),
    'BLOCK 6: anon must NOT have DELETE on aceptaciones_documentos_legales';

  -- DELETE itself must actually succeed for the current session (postgres,
  -- which is not blocked by a trigger — only grants gate authenticated/anon).
  delete from public.aceptaciones_documentos_legales where id = v_acc_id;

  raise notice 'BLOCK 6 PASSED: UPDATE blocked for everyone; DELETE grant is service_role-only and functional';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 6b — aceptaciones_documentos_legales: TRUNCATE blocked for postgres
-- AND service_role (only a filtered DELETE is allowed, never TRUNCATE).
-- service_role has no table-level TRUNCATE grant (explicitly revoked in
-- BLOCK 10b's privilege matrix), so Postgres denies it before the row-level
-- trigger even fires; the trigger (rechazar_truncate_aceptaciones_documentos_legales)
-- remains as defense in depth for postgres/any role that does hold TRUNCATE.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_doc_id uuid;
  v_acc_id uuid;
  v_pac_id uuid := 'd0000005-0000-0000-0000-000000000000';
begin
  raise notice '--- BLOCK 6b: aceptaciones_documentos_legales TRUNCATE blocked (postgres + service_role) ---';

  -- '9.9' avoids colliding with the real seeded '1.0' row.
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.9', 'Consentimiento v1', 'texto', now())
  returning id into v_doc_id;

  insert into public.aceptaciones_documentos_legales (paciente_id, user_id, documento_id, tipo)
  values (v_pac_id, null, v_doc_id, 'CONSENTIMIENTO_APP_PACIENTE')
  returning id into v_acc_id;

  begin
    truncate public.aceptaciones_documentos_legales;
    assert false, 'BLOCK 6b: TRUNCATE on aceptaciones_documentos_legales was accepted — TRUNCATE guard missing';
  exception
    when others then
      assert sqlerrm like '%modificacion_no_permitida%',
        format('BLOCK 6b: expected modificacion_no_permitida on TRUNCATE, got %L', sqlerrm);
      raise notice '  TRUNCATE by postgres correctly rejected';
  end;

  begin
    truncate public.aceptaciones_documentos_legales cascade;
    assert false, 'BLOCK 6b: TRUNCATE ... CASCADE on aceptaciones_documentos_legales was accepted — TRUNCATE guard missing';
  exception
    when others then
      assert sqlerrm like '%modificacion_no_permitida%',
        format('BLOCK 6b: expected modificacion_no_permitida on TRUNCATE CASCADE, got %L', sqlerrm);
      raise notice '  TRUNCATE CASCADE by postgres correctly rejected';
  end;

  begin
    set local role service_role;
    truncate public.aceptaciones_documentos_legales;
    reset role;
    assert false, 'BLOCK 6b: TRUNCATE on aceptaciones_documentos_legales by service_role was accepted — only a filtered DELETE is allowed';
  exception
    when others then
      reset role;
      -- Two independent guards, same pattern as BLOCK 3: the grant-level
      -- revoke (BLOCK 10b's privilege matrix) denies TRUNCATE to service_role
      -- before Postgres even evaluates the trigger; the trigger is the
      -- fallback if that grant were ever mistakenly reintroduced.
      assert sqlerrm like '%modificacion_no_permitida%'
          or sqlerrm like '%permission denied for table aceptaciones_documentos_legales%',
        format('BLOCK 6b: expected service_role TRUNCATE to be blocked, got %L', sqlerrm);
      raise notice '  TRUNCATE by service_role correctly rejected (%)', sqlerrm;
  end;

  begin
    set local role service_role;
    truncate public.aceptaciones_documentos_legales cascade;
    reset role;
    assert false, 'BLOCK 6b: TRUNCATE ... CASCADE by service_role was accepted — only a filtered DELETE is allowed';
  exception
    when others then
      reset role;
      assert sqlerrm like '%modificacion_no_permitida%'
          or sqlerrm like '%permission denied for table aceptaciones_documentos_legales%',
        format('BLOCK 6b: expected service_role TRUNCATE CASCADE to be blocked, got %L', sqlerrm);
      raise notice '  TRUNCATE CASCADE by service_role correctly rejected (%)', sqlerrm;
  end;

  -- The TRUNCATE guard must not regress the filtered DELETE exception for
  -- service_role (purge-test-paciente.mjs).
  set local role service_role;
  delete from public.aceptaciones_documentos_legales where paciente_id = v_pac_id;
  reset role;

  assert not exists (
    select 1 from public.aceptaciones_documentos_legales where id = v_acc_id
  ), 'BLOCK 6b: filtered DELETE as service_role did not remove the row after adding the TRUNCATE guard';

  raise notice 'BLOCK 6b PASSED: TRUNCATE (and CASCADE) blocked for postgres and service_role; filtered DELETE as service_role still works';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 8 — Table privileges: authenticated/anon denied write + truncate on
-- both tables (defense in depth beyond RLS — TRUNCATE ignores RLS entirely)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_table text;
begin
  raise notice '--- BLOCK 8: authenticated/anon write + truncate lockdown ---';

  foreach v_table in array array['documentos_legales', 'aceptaciones_documentos_legales']
  loop
    assert not has_table_privilege('authenticated', format('public.%I', v_table), 'insert'),
      format('BLOCK 8: authenticated must NOT have INSERT on %s', v_table);
    assert not has_table_privilege('authenticated', format('public.%I', v_table), 'update'),
      format('BLOCK 8: authenticated must NOT have UPDATE on %s', v_table);
    assert not has_table_privilege('authenticated', format('public.%I', v_table), 'truncate'),
      format('BLOCK 8: authenticated must NOT have TRUNCATE on %s', v_table);

    assert not has_table_privilege('anon', format('public.%I', v_table), 'insert'),
      format('BLOCK 8: anon must NOT have INSERT on %s', v_table);
    assert not has_table_privilege('anon', format('public.%I', v_table), 'select'),
      format('BLOCK 8: anon must NOT have SELECT on %s', v_table);
    assert not has_table_privilege('anon', format('public.%I', v_table), 'truncate'),
      format('BLOCK 8: anon must NOT have TRUNCATE on %s', v_table);
  end loop;

  raise notice 'BLOCK 8 PASSED: authenticated/anon hold no write or truncate privilege on either table';
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 9 — resolver_documentos_legales_vigentes: branch coverage
-- ─────────────────────────────────────────────────────────────────────────────
-- All rows are inserted and rolled back inside this block's own transaction.
-- The real seed migration has already committed CONSENTIMIENTO/
-- TERMINOS 1.0 rows dated in the past (2026-09-13 / 2026-08-29), so this block
-- can no longer assume an empty table. It uses version '9.x' (never seeded)
-- so its rows never collide with real data under unique(tipo, version), and
-- publicado_at = now() - interval '1 second' / now() (instead of an earlier
-- now() - interval '1 day' / now()) so its temp rows are always more recent
-- than the real seed's fixed past dates regardless of when this suite runs,
-- while still satisfying "published <= now()".

begin;

do $$
declare
  v_consent_id uuid;
  v_terms_id   uuid;
  v_result     uuid[];
begin
  raise notice '--- BLOCK 9: resolver_documentos_legales_vigentes ---';

  -- 9a: empty submission against the current vigente set -> null (fail
  -- closed). Not a literal "empty table" case since the seed rows are
  -- always present, but an empty payload still can never match the
  -- non-empty current set, exercising the same fail-closed default path.
  v_result := public.resolver_documentos_legales_vigentes('[]'::jsonb);
  assert v_result is null,
    format('BLOCK 9a: expected null on empty submission, got %L', v_result);
  raise notice '  9a empty submission -> null: PASSED';

  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.0', 'Consentimiento v9 (temp)', 'texto', now() - interval '1 second')
  returning id into v_consent_id;

  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('TERMINOS_CONDICIONES_APP_PACIENTE', '9.0', 'Terminos v9 (temp)', 'texto', now() - interval '1 second')
  returning id into v_terms_id;

  -- 9b: exact match -> both ids. These temp '9.0' rows outrank the real
  -- seeded '1.0' rows (later publicado_at), so they become the vigente set.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.0'),
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '9.0')
    )
  );
  assert v_result is not null and array_length(v_result, 1) = 2,
    format('BLOCK 9b: expected 2 resolved ids on exact match, got %L', v_result);
  assert v_consent_id = any(v_result) and v_terms_id = any(v_result),
    'BLOCK 9b: resolved ids must include both current document ids';
  raise notice '  9b exact match -> 2 ids: PASSED';

  -- 9c: missing one document type -> null.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.0')
    )
  );
  assert v_result is null,
    format('BLOCK 9c: expected null when a required type is missing, got %L', v_result);
  raise notice '  9c missing type -> null: PASSED';

  -- 9d: extra/unknown document -> null.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.0'),
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '9.0'),
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.9')
    )
  );
  assert v_result is null,
    format('BLOCK 9d: expected null when an extra/unknown document is submitted, got %L', v_result);
  raise notice '  9d extra document -> null: PASSED';

  -- 9e: old version submitted after a newer version is published -> null.
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.1', 'Consentimiento v9.1 (temp)', 'texto nuevo', now());

  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.0'),
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '9.0')
    )
  );
  assert v_result is null,
    format('BLOCK 9e: expected null when submitted consent version is stale, got %L', v_result);
  raise notice '  9e stale version -> null: PASSED';

  -- At this point the vigente set is CONSENTIMIENTO_APP_PACIENTE/9.1 (the
  -- newer publication from 9e) + TERMINOS_CONDICIONES_APP_PACIENTE/9.0.

  -- 9f: duplicate tipo (mixed versions), the other required tipo never
  --     mentioned -> null. Regression test for the resolver's original
  --     COUNT-based comparison, which let a duplicated tipo silently stand
  --     in for the type the caller never sent.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.1'),
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.0')
    )
  );
  assert v_result is null,
    format('BLOCK 9f: expected null when the payload repeats one tipo (mixed versions) and omits the other, got %L', v_result);
  raise notice '  9f duplicate tipo (mixed versions), other tipo missing -> null: PASSED';

  -- 9g: the exploit this fix closes — the SAME valid
  --     {tipo, version} pair duplicated exactly v_current_count times, the
  --     other required tipo never mentioned. Pre-fix, the COUNT-based check
  --     coincidentally matched (submitted_count = jsonb_array_length =
  --     current_count) and the function returned BOTH current ids, letting
  --     vincular_cuenta_paciente record acceptance of a document the caller
  --     never referenced.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.1'),
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.1')
    )
  );
  assert v_result is null,
    format('BLOCK 9g (CRITICAL regression): duplicate valid pair bypassed set-equality check, got %L — the caller could force acceptance of a tipo it never sent', v_result);
  raise notice '  9g duplicate identical valid pair, other tipo missing -> null: PASSED (exploit closed)';

  -- 9h: unknown/misspelled tipo string -> null, and MUST NOT raise — the
  --     resolver is called from an unauthenticated pre-check path
  --     (createAccount.ts) and must never surface an uncaught exception as
  --     a 500.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'TIPO_QUE_NO_EXISTE', 'version', '9.0'),
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '9.0')
    )
  );
  assert v_result is null,
    format('BLOCK 9h: expected null for an unknown tipo value, got %L', v_result);
  raise notice '  9h unknown tipo string -> null, no exception: PASSED';

  -- 9i: malformed element shape (extra key beyond tipo/version) -> null.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.1', 'extra', 'campo'),
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '9.0')
    )
  );
  assert v_result is null,
    format('BLOCK 9i: expected null when an element has an unexpected extra key, got %L', v_result);
  raise notice '  9i malformed element (extra key) -> null: PASSED';

  -- 9j: exact current set submitted in reverse order -> resolves both ids
  --     (set equality must not depend on array order).
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '9.0'),
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.1')
    )
  );
  assert v_result is not null and array_length(v_result, 1) = 2,
    format('BLOCK 9j: expected 2 resolved ids for the exact current set in reverse order, got %L', v_result);
  raise notice '  9j exact current set, reverse order -> 2 ids: PASSED';

  -- 9k: deterministic tiebreak when two rows share the SAME tipo and the SAME
  -- publicado_at (a real scenario: two documents published via the same
  -- deploy/seed batch). Before the fix, `distinct on (d.tipo) ... order by
  -- d.tipo, d.publicado_at desc` had no third ordering key, so Postgres could
  -- pick either row nondeterministically. Reserved test versions (9.x — see
  -- BLOCK 1-10's reserved-version note) to avoid any collision with the real
  -- seed's 1.0/1.1 rows.
  declare
    v_tie_low_id  uuid;
    v_tie_high_id uuid;
    v_tie_at      timestamptz := now();
    v_winner_ver  text;
    v_loser_ver   text;
  begin
    -- Current vigente set at this point in the transaction (per 9e/9j above)
    -- is CONSENTIMIENTO_APP_PACIENTE/9.1 + TERMINOS_CONDICIONES_APP_PACIENTE/
    -- 9.0. The two new tied rows below (9.3/9.4, same publicado_at) outrank
    -- that existing TERMINOS/9.0 row (same instant as 9e's now(), later than
    -- 9b's now() - interval '1 second' — recall now() is transaction-start
    -- time, constant for this whole block), so they become the new
    -- candidates and only the resolver's id-based tiebreak decides between
    -- them.
    insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
    values ('TERMINOS_CONDICIONES_APP_PACIENTE', '9.3', 'Terminos tie A', 'texto', v_tie_at)
    returning id into v_tie_low_id;

    insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
    values ('TERMINOS_CONDICIONES_APP_PACIENTE', '9.4', 'Terminos tie B', 'texto', v_tie_at)
    returning id into v_tie_high_id;

    -- Normalize so v_tie_high_id really is the greater uuid (gen_random_uuid
    -- is not monotonic — insertion order does not guarantee id order).
    if v_tie_low_id > v_tie_high_id then
      declare v_swap uuid; begin
        v_swap := v_tie_low_id;
        v_tie_low_id := v_tie_high_id;
        v_tie_high_id := v_swap;
      end;
    end if;

    select version into v_winner_ver from public.documentos_legales where id = v_tie_high_id;
    select version into v_loser_ver  from public.documentos_legales where id = v_tie_low_id;

    -- Submitting the higher-id row's version (plus the current consent
    -- version, 9.1) must resolve successfully and return the higher id — the
    -- deterministic winner, per `order by d.tipo, d.publicado_at desc, d.id
    -- desc`.
    v_result := public.resolver_documentos_legales_vigentes(
      jsonb_build_array(
        jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.1'),
        jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', v_winner_ver)
      )
    );
    assert v_result is not null and v_tie_high_id = any(v_result) and not (v_tie_low_id = any(v_result)),
      format('BLOCK 9k: expected the higher-id row (%L) to win the tie, got %L', v_tie_high_id, v_result);

    -- Submitting the LOWER-id row's version must now be treated as stale
    -- (superseded by the deterministic winner) -> null, same as 9e.
    v_result := public.resolver_documentos_legales_vigentes(
      jsonb_build_array(
        jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '9.1'),
        jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', v_loser_ver)
      )
    );
    assert v_result is null,
      format('BLOCK 9k: expected null submitting the lower-id tied row (%L), got %L', v_loser_ver, v_result);
  end;
  raise notice '  9k tie (same tipo, same publicado_at) -> deterministic higher-id winner: PASSED';

  raise notice 'BLOCK 9 PASSED: resolver_documentos_legales_vigentes handles all branches';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 10 — resolver_documentos_legales_vigentes: EXECUTE grant is
-- service_role-only
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  raise notice '--- BLOCK 10: resolver_documentos_legales_vigentes EXECUTE grants ---';

  assert has_function_privilege('service_role', 'public.resolver_documentos_legales_vigentes(jsonb)', 'execute'),
    'BLOCK 10: service_role must have EXECUTE on resolver_documentos_legales_vigentes';
  assert not has_function_privilege('authenticated', 'public.resolver_documentos_legales_vigentes(jsonb)', 'execute'),
    'BLOCK 10: authenticated must NOT have EXECUTE on resolver_documentos_legales_vigentes';
  assert not has_function_privilege('anon', 'public.resolver_documentos_legales_vigentes(jsonb)', 'execute'),
    'BLOCK 10: anon must NOT have EXECUTE on resolver_documentos_legales_vigentes';

  raise notice 'BLOCK 10 PASSED: EXECUTE is service_role-only';
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 10b — service_role explicit privilege matrix, deterministic
-- regardless of default privileges: documentos_legales is SELECT-only
-- (insert/update/delete/truncate explicitly revoked); aceptaciones_
-- documentos_legales is SELECT+DELETE-only (insert/update/truncate
-- explicitly revoked). SELECT is needed on aceptaciones_documentos_legales
-- for the filtered DELETE below ("DELETE ... WHERE paciente_id = ..." needs
-- Postgres to evaluate the WHERE predicate, which requires SELECT too).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

do $$
declare
  v_doc_id uuid;
  v_acc_id uuid;
  v_pac_id uuid := 'd0000005-0000-0000-0000-000000000000';
begin
  raise notice '--- BLOCK 10b: service_role SELECT grants (aceptaciones_documentos_legales, documentos_legales) ---';

  -- '9.9' avoids colliding with the real seeded '1.0' row.
  insert into public.documentos_legales (tipo, version, titulo, contenido_md, publicado_at)
  values ('CONSENTIMIENTO_APP_PACIENTE', '9.9', 'Consentimiento v1', 'texto', now())
  returning id into v_doc_id;

  insert into public.aceptaciones_documentos_legales (paciente_id, user_id, documento_id, tipo)
  values (v_pac_id, null, v_doc_id, 'CONSENTIMIENTO_APP_PACIENTE')
  returning id into v_acc_id;

  -- Grant-level checks
  assert has_table_privilege('service_role', 'public.aceptaciones_documentos_legales', 'select'),
    'BLOCK 10b: service_role must have SELECT on aceptaciones_documentos_legales (required to evaluate a filtered DELETE WHERE predicate)';
  assert has_table_privilege('service_role', 'public.aceptaciones_documentos_legales', 'delete'),
    'BLOCK 10b: service_role must retain DELETE on aceptaciones_documentos_legales';
  assert not has_table_privilege('service_role', 'public.aceptaciones_documentos_legales', 'update'),
    'BLOCK 10b: service_role must NOT have UPDATE on aceptaciones_documentos_legales (insert-only: trigger + explicit revoke)';
  assert not has_table_privilege('service_role', 'public.aceptaciones_documentos_legales', 'insert'),
    'BLOCK 10b: service_role must NOT have INSERT on aceptaciones_documentos_legales (only vincular_cuenta_paciente inserts, running as the security definer function owner, never as service_role)';
  assert not has_table_privilege('service_role', 'public.aceptaciones_documentos_legales', 'truncate'),
    'BLOCK 10b: service_role must NOT have TRUNCATE on aceptaciones_documentos_legales (grant-level, in addition to the row-level TRUNCATE trigger)';
  assert has_table_privilege('service_role', 'public.documentos_legales', 'select'),
    'BLOCK 10b: service_role must have SELECT on documentos_legales (vault reads current documents via REST as service_role)';
  assert not has_table_privilege('service_role', 'public.documentos_legales', 'insert'),
    'BLOCK 10b: service_role must NOT have INSERT on documentos_legales (only the seed migration inserts, running as postgres, never as service_role)';
  assert not has_table_privilege('service_role', 'public.documentos_legales', 'update'),
    'BLOCK 10b: service_role must NOT have UPDATE on documentos_legales (grant-level, in addition to the immutability trigger)';
  assert not has_table_privilege('service_role', 'public.documentos_legales', 'delete'),
    'BLOCK 10b: service_role must NOT have DELETE on documentos_legales (SELECT-only per the privilege matrix; immutability trigger blocks it too)';
  assert not has_table_privilege('service_role', 'public.documentos_legales', 'truncate'),
    'BLOCK 10b: service_role must NOT have TRUNCATE on documentos_legales (grant-level, in addition to the row-level TRUNCATE trigger)';

  -- anon/authenticated must stay exactly as originally defined — no
  -- regression from adding the service_role grants above.
  assert has_table_privilege('authenticated', 'public.aceptaciones_documentos_legales', 'select'),
    'BLOCK 10b: authenticated SELECT on aceptaciones_documentos_legales must remain (admin_select_all_* reachability)';
  assert not has_table_privilege('anon', 'public.aceptaciones_documentos_legales', 'select'),
    'BLOCK 10b: anon must NOT have SELECT on aceptaciones_documentos_legales';
  assert has_table_privilege('authenticated', 'public.documentos_legales', 'select'),
    'BLOCK 10b: authenticated SELECT on documentos_legales must remain (admin_select_all_* reachability)';
  assert not has_table_privilege('anon', 'public.documentos_legales', 'select'),
    'BLOCK 10b: anon must NOT have SELECT on documentos_legales';
  assert not has_table_privilege('authenticated', 'public.aceptaciones_documentos_legales', 'delete'),
    'BLOCK 10b: authenticated must NOT have DELETE on aceptaciones_documentos_legales';
  assert not has_table_privilege('anon', 'public.aceptaciones_documentos_legales', 'delete'),
    'BLOCK 10b: anon must NOT have DELETE on aceptaciones_documentos_legales';

  -- Behavioral check: a filtered DELETE as
  -- service_role must succeed, not "permission denied for table
  -- aceptaciones_documentos_legales" (Postgres needs SELECT to evaluate the
  -- WHERE predicate, even though the matched row is deleted, not read).
  set local role service_role;
  delete from public.aceptaciones_documentos_legales where paciente_id = v_pac_id;
  reset role;

  assert not exists (
    select 1 from public.aceptaciones_documentos_legales where id = v_acc_id
  ), 'BLOCK 10b: filtered DELETE as service_role did not remove the row';

  -- Immutability still blocks UPDATE on documentos_legales for service_role
  -- too (BLOCK 3 already proves this for the default session role) —
  -- reconfirm here so a future grant regression cannot silently reopen it.
  begin
    set local role service_role;
    update public.documentos_legales set titulo = 'cambiado' where id = v_doc_id;
    reset role;
    assert false, 'BLOCK 10b: UPDATE on documentos_legales by service_role was accepted — immutability trigger or grant regression';
  exception
    when others then
      reset role;
      raise notice '  UPDATE by service_role correctly rejected (trigger and/or grant)';
  end;

  raise notice 'BLOCK 10b PASSED: service_role has SELECT+DELETE (not UPDATE) on aceptaciones_documentos_legales, SELECT on documentos_legales; anon/authenticated unchanged';
end;
$$;

rollback;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 11 — seeded consent v1.0: pinned SHA-256 drift guard
-- ─────────────────────────────────────────────────────────────────────────────
-- The seed migration (supabase/migrations/<seed>_seed_documentos_legales.sql)
-- seeds the (sample) CONSENTIMIENTO_APP_PACIENTE 1.0 row. This pins its
-- contenido_md hash so any future accidental edit (in the seed migration OR
-- in app-paciente' hardcoded CONSENT_MARKDOWN, which must byte-match)
-- fails loudly on both sides. Hash recipe:
-- encode(sha256(convert_to(contenido_md,'UTF8')),'hex')
-- over the UTF-8 bytes of contenido_md, LF line endings, NO trailing newline
-- (see seed migration header for the exact normalization rule).

do $$
declare
  v_hash text;
begin
  raise notice '--- BLOCK 11: seeded consent v1.0 pinned SHA-256 ---';

  select encode(sha256(convert_to(contenido_md, 'UTF8')), 'hex')
    into v_hash
    from public.documentos_legales
   where tipo = 'CONSENTIMIENTO_APP_PACIENTE'
     and version = '1.0';

  assert v_hash is not null,
    'BLOCK 11: seeded CONSENTIMIENTO_APP_PACIENTE 1.0 row not found — has the seed migration run?';

  assert v_hash = '351d070db8e3d4f854a60e07187ed9de9f3ce9bbfe2b389b7dd92cb270622b08',
    format('BLOCK 11: consent v1.0 contenido_md hash drifted from the pinned literal, got %L', v_hash);

  raise notice 'BLOCK 11 PASSED: consent v1.0 contenido_md hash matches the pinned literal';
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 12 — resolver_documentos_legales_vigentes: real seeded pairs resolve
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_consent_id uuid;
  v_terms_id   uuid;
  v_result     uuid[];
begin
  raise notice '--- BLOCK 12: resolver against real seeded documentos_legales rows ---';

  select id into v_consent_id
    from public.documentos_legales
   where tipo = 'CONSENTIMIENTO_APP_PACIENTE' and version = '1.0';

  select id into v_terms_id
    from public.documentos_legales
   where tipo = 'TERMINOS_CONDICIONES_APP_PACIENTE' and version = '1.0';

  assert v_consent_id is not null, 'BLOCK 12: seeded CONSENTIMIENTO_APP_PACIENTE 1.0 row not found';
  assert v_terms_id is not null, 'BLOCK 12: seeded TERMINOS_CONDICIONES_APP_PACIENTE 1.0 row not found';

  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '1.0'),
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '1.0')
    )
  );

  assert v_result is not null and array_length(v_result, 1) = 2,
    format('BLOCK 12: expected 2 resolved ids for real seeded pairs, got %L', v_result);
  assert v_consent_id = any(v_result) and v_terms_id = any(v_result),
    'BLOCK 12: resolved ids must include the real seeded consent and terms ids';

  raise notice 'BLOCK 12 PASSED: resolver returns the real seeded document ids for the real seeded pairs';
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 13 — resolver_documentos_legales_vigentes: stale/unknown version
-- against real seeded data resolves to null
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_result uuid[];
begin
  raise notice '--- BLOCK 13: resolver stale/unknown version against real seeded data ---';

  -- Unknown version for a real seeded tipo.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'CONSENTIMIENTO_APP_PACIENTE', 'version', '0.9'),
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '1.0')
    )
  );
  assert v_result is null,
    format('BLOCK 13: expected null for an unknown consent version against real seeded data, got %L', v_result);
  raise notice '  unknown version -> null: PASSED';

  -- Missing one of the two required types.
  v_result := public.resolver_documentos_legales_vigentes(
    jsonb_build_array(
      jsonb_build_object('tipo', 'TERMINOS_CONDICIONES_APP_PACIENTE', 'version', '1.0')
    )
  );
  assert v_result is null,
    format('BLOCK 13: expected null when a required type is missing against real seeded data, got %L', v_result);
  raise notice '  missing type -> null: PASSED';

  raise notice 'BLOCK 13 PASSED: resolver stays fail-closed against real seeded data for stale/unknown/missing input';
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Summary
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  raise notice '=================================================================';
  raise notice 'ALL SQL ASSERTION BLOCKS COMPLETED SUCCESSFULLY';
  raise notice '=================================================================';
  raise notice '  1  tipo_documento_legal enum values';
  raise notice '  2  documentos_legales unique(tipo, version)';
  raise notice '  3  documentos_legales immutability (UPDATE/DELETE/TRUNCATE)';
  raise notice '  4  aceptaciones_documentos_legales composite FK (documento_id, tipo)';
  raise notice '  5  aceptaciones_documentos_legales unique(paciente_id, documento_id)';
  raise notice '  6  aceptaciones_documentos_legales UPDATE blocked, DELETE service_role-only';
  raise notice '  6b aceptaciones_documentos_legales TRUNCATE blocked (postgres + service_role)';
  raise notice '  7  RLS admin-only SELECT';
  raise notice '  8  authenticated/anon write + truncate lockdown';
  raise notice '  9  resolver_documentos_legales_vigentes branch coverage';
  raise notice '  10 resolver_documentos_legales_vigentes EXECUTE grants';
  raise notice '  10b service_role SELECT grants (filtered DELETE + documentos_legales read)';
  raise notice '  11 seeded consent v1.0 pinned SHA-256 drift guard';
  raise notice '  12 resolver_documentos_legales_vigentes real seeded pairs resolve';
  raise notice '  13 resolver_documentos_legales_vigentes stale/unknown vs real seeded data';
  raise notice '=================================================================';
end;
$$;
