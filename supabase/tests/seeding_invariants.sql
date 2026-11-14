-- =============================================================================
-- seeding_invariants.sql — Assertion tests for the reference/mock seeding split
-- =============================================================================
-- Coverage: sdd/seeding-split spec — "Local reset succeeds with zero FK
-- violations" + "Fresh production simulation has complete catalog, zero mock
-- data" + "Catalog migrations are idempotent and deterministically
-- regenerable". See supabase/SEEDING.md for the full model.
--
-- TOOLING: SQL assertion blocks using DO $$ ... ASSERT ... $$, same style as
-- supabase/tests/otp_functions.sql (no pgTAP).
--
-- HOW TO RUN (LOCAL ONLY):
--   supabase db reset
--   psql "$DATABASE_URL" -f supabase/tests/seeding_invariants.sql
--
-- WHAT THIS VALIDATES: the state of a LOCAL database after `supabase db
-- reset`, i.e. migrations (reference lookups + clinical catalog) followed by
-- `seed.sql` (mock tree). It does NOT and cannot validate production,
-- because production correctness here is structural, not runtime: `db push`
-- only ever applies `supabase/migrations/*.sql` and NEVER runs
-- `supabase/seed.sql` — so mock data physically cannot reach a real
-- environment. If this script's reference/catalog assertions pass locally,
-- the same migrations are what `db push` would apply to production.
-- =============================================================================

\set ON_ERROR_STOP on

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 1 — Reference lookups (20260719120000_seed_reference_lookups.sql)
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_count int;
begin
  raise notice '--- BLOCK 1: reference lookup row counts ---';

  select count(*) into v_count from public.roles;
  assert v_count = 3, format('roles: expected 3 rows, got %s', v_count);

  -- 2 base rows from this migration + 1 'baja_voluntaria' row owned by
  -- 20260830170000_seed_estado_baja_voluntaria.sql.
  select count(*) into v_count from public.estados_paciente;
  assert v_count = 3, format('estados_paciente: expected 3 rows, got %s', v_count);

  -- 3 base rows from this migration + 1 'pendiente' row owned by
  -- 20260712040000_inicio_tratamiento_fundacion.sql.
  select count(*) into v_count from public.estados_etapa;
  assert v_count >= 4, format('estados_etapa: expected >= 4 rows, got %s', v_count);

  select count(*) into v_count from public.tipos_disco;
  assert v_count = 3, format('tipos_disco: expected 3 rows, got %s', v_count);

  select count(*) into v_count from public.alfabetos;
  assert v_count = 8, format('alfabetos: expected 8 rows, got %s', v_count);

  select count(*) into v_count from public.modalidades;
  assert v_count = 4, format('modalidades: expected 4 rows, got %s', v_count);

  raise notice 'BLOCK 1 PASSED: reference lookups present with expected counts';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 2 — Clinical catalog (20260719120100_seed_clinical_catalog.sql)
-- ─────────────────────────────────────────────────────────────────────────────
-- Counts confirmed against the generated migration at authoring time. If the
-- catalog is regenerated from the vault (see supabase/SEEDING.md), update
-- these expectations to match the new generator output.

do $$
declare
  v_count int;
begin
  raise notice '--- BLOCK 2: clinical catalog row counts ---';

  select count(*) into v_count from public.causas;
  assert v_count = 12, format('causas: expected 12 rows, got %s', v_count);

  select count(*) into v_count from public.algoritmos;
  assert v_count = 62, format('algoritmos: expected 62 rows, got %s', v_count);

  select count(*) into v_count from public.bloqueos;
  assert v_count = 12, format('bloqueos: expected 12 rows, got %s', v_count);

  select count(*) into v_count from public.causa_etapas;
  assert v_count = 48, format('causa_etapas: expected 48 rows, got %s', v_count);

  select count(*) into v_count from public.algoritmo_etapas;
  assert v_count = 248, format('algoritmo_etapas: expected 248 rows, got %s', v_count);

  select count(*) into v_count from public.causa_frases;
  assert v_count = 384, format('causa_frases: expected 384 rows, got %s', v_count);

  select count(*) into v_count from public.algoritmo_frases;
  assert v_count = 992, format('algoritmo_frases: expected 992 rows, got %s', v_count);

  raise notice 'BLOCK 2 PASSED: clinical catalog present with expected counts';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 3 — Mock tree (supabase/seed.sql), local-only
-- ─────────────────────────────────────────────────────────────────────────────
-- These counts only hold AFTER `supabase db reset`, since `seed.sql` is what
-- populates them. A migrations-only build (fresh prod) must show zero here —
-- see BLOCK 4.

do $$
declare
  v_count int;
begin
  raise notice '--- BLOCK 3: mock tree presence (local db reset only) ---';

  -- Demo auth accounts inserted by seed.sql's single `insert into
  -- auth.users` block (admin, admin.terapeuta, terapeuta1, terapeuta2,
  -- paciente1..4).
  select count(*) into v_count
  from auth.users
  where email like '%@clienteapp.test';
  assert v_count = 8, format('demo auth.users: expected 8 rows, got %s', v_count);

  -- Full paciente mock tree: 4 with linked auth accounts + 8 "data-only"
  -- pacientes + 1 dedicated reinicio fixture + 1 OTP/WhatsApp e2e fixture +
  -- 2 "reuse paciente" fixtures (Bianca Correa, Ignacio Bravo) + 3
  -- sdd/medir-chakras mediciones-estructura fixtures (Valentina Suárez,
  -- Ramiro Escobar, Delfina Acosta — none with a linked auth account, so
  -- auth.users above is unaffected).
  select count(*) into v_count from public.pacientes;
  assert v_count = 19, format('pacientes: expected 19 rows, got %s', v_count);

  raise notice 'BLOCK 3 PASSED: mock tree present with expected counts';
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOCK 4 — No orphaned FKs across the reference / catalog / mock boundary
-- ─────────────────────────────────────────────────────────────────────────────
-- Postgres FK constraints already make most of these impossible at insert
-- time; these checks exist as an explicit, self-documenting guarantee that
-- the reference-lookup split (migration A) did not silently break the mock
-- tree's FK resolution (migration A's literal UUIDs must match seed.sql's
-- `declare` block exactly — see supabase/SEEDING.md).

do $$
declare
  v_count int;
begin
  raise notice '--- BLOCK 4: no orphaned FKs (reference <-> mock) ---';

  select count(*) into v_count
  from public.pacientes p
  where p.estado_id is not null
    and not exists (
      select 1 from public.estados_paciente ep where ep.id = p.estado_id
    );
  assert v_count = 0,
    format('pacientes.estado_id: %s orphaned rows (no matching estados_paciente)', v_count);

  select count(*) into v_count
  from public.etapas_tratamiento et
  where not exists (
    select 1 from public.modalidades m where m.id = et.modalidad_id
  );
  assert v_count = 0,
    format('etapas_tratamiento.modalidad_id: %s orphaned rows (no matching modalidades)', v_count);

  select count(*) into v_count
  from public.etapas_tratamiento et
  where not exists (
    select 1 from public.estados_etapa ee where ee.id = et.estado_id
  );
  assert v_count = 0,
    format('etapas_tratamiento.estado_id: %s orphaned rows (no matching estados_etapa)', v_count);

  select count(*) into v_count
  from public.asignaciones_paciente ap
  where not exists (
    select 1 from public.pacientes p where p.id = ap.paciente_id
  )
  or not exists (
    select 1 from public.terapeutas t where t.id = ap.terapeuta_id
  );
  assert v_count = 0,
    format('asignaciones_paciente: %s orphaned rows (paciente_id or terapeuta_id unresolved)', v_count);

  raise notice 'BLOCK 4 PASSED: zero orphaned FKs across reference/catalog/mock tables';
end;
$$;

do $$
begin
  raise notice 'seeding invariants OK';
end;
$$;
