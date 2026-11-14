/**
 * patient-rpcs.ts — Happy-path contract tests for the 6 patient RPCs.
 *
 * PURPOSE
 * -------
 * Exercises the six RPCs exposed to the patient mobile app (DevSpec §11 / Epic 5
 * + medicionEvolutiva Phase 0):
 *
 *   T1 — get_mi_perfil()              → 9-key profile jsonb
 *   T2 — get_mi_tratamiento_activo()  → 7-key progress jsonb
 *   T3 — get_mi_plan_semanal()        → array of weekly plan objects
 *   T4 — get_mi_evaluacion_vigente()  → vigente nivel + 2 frases esperadas
 *   T5 — submit_mi_evaluacion(v_nivel_1_1, 3, 4)
 *          → { ok: true }; service-role read confirms score === 3.5
 *   T6 — get_mi_estructura_actual()   → 3 mediciones (happy path, pac1 seed)
 *   T7 — get_mi_estructura_actual()   → BA date boundary + cierre_automatico
 *          exclusion + empty precondition (pac4)
 *
 * EXECUTION CONSTRAINT
 * --------------------
 * Live execution requires a deployed Supabase environment (local Docker or branch
 * deploy). Docker is NOT available in the WSL2 dev environment; execution is
 * deferred. Run with:
 *
 *   deno run \
 *     --allow-net \
 *     --allow-env \
 *     --config supabase/tests/deno.json \
 *     --unstable-sloppy-imports \
 *     supabase/tests/patient-rpcs.ts
 *
 * The --config flag activates the @/ import map (used by the mapper's internal
 * imports). --unstable-sloppy-imports handles extensionless relative imports
 * inside the mapper source (PacienteTypes, computeEdad).
 *
 * Environment variables:
 *
 *   SUPABASE_URL              — e.g. https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service-role JWT (never committed)
 *   SUPABASE_ANON_KEY         — anon JWT
 *   SUPABASE_TEST_USER_EMAIL  — auth email of the seed patient (default: paciente1@clienteapp.test)
 *   SUPABASE_TEST_USER_PASS   — password for the above user (default: local-seed-cgGqBIrprZGocA9r5Jxm)
 *
 * NOTE: NO FUNCTION_BASE_URL — these are database rpc() calls, not Edge Functions.
 *
 * PRIMARY TEST SUBJECT (pac1 — Sofía Rodríguez)
 * -----------------------------------------------
 * Auth email:          paciente1@clienteapp.test
 * pacientes.email:     sofia.rodriguez@paciente.test  ← what get_mi_perfil returns
 * paciente_id:         d0000001-0000-0000-0000-000000000000
 * etapa_id (etapa1):   e0000001-0000-0000-0000-000000000000
 * causa / algoritmo:   CAU-02 / ALG-03
 * fecha_inicio:        2026-05-05
 * niveles:             4 (all null fecha_seguimiento_real — ninguno cerrado)
 *   nivel 1 (v_nivel_1_1):  fecha_seguimiento_esperada = 2026-06-05 ≤ today → VIGENTE
 *   nivel 2 (v_nivel_1_2):  fecha_seguimiento_esperada = 2026-07-05 → proximaEvaluacion
 *   nivel 3:                fecha_seguimiento_esperada = 2026-08-05
 *   nivel 4:                fecha_seguimiento_esperada = 2026-09-05
 *
 * STALE WARNING — seed-credentials.md says "Sofía Nivel 1 completado (score 4/5)"
 * but that is OUTDATED. seed.sql line ~680 ("Sofía: sin scores aún") is the source
 * of truth: Sofía has NO nivel_evaluacion rows. The submit test on v_nivel_1_1 is
 * therefore clean and fully reversible.
 *
 * CLEANUP
 * -------
 * fullCleanup() deletes the nivel_evaluacion row created by T5 (submit on v_nivel_1_1)
 * via the service-role client, restoring the seed state (Sofía with no evaluaciones).
 * It is called at the end of the suite and in each test failure handler.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
// Task 5.2 — parity test: import the REAL mapper so the guarantee is genuine.
// Requires --config supabase/tests/deno.json (for @/app/utils/score inside the mapper)
// and --unstable-sloppy-imports (for extensionless relative imports inside the mapper).
import {
  mapAsignacionToPaciente,
  type AsignacionRaw,
} from '../../app/controllers/Paciente/utils/mapAsignacionToPaciente.ts'

// ── Configuration ──────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const TEST_USER_EMAIL =
  Deno.env.get('SUPABASE_TEST_USER_EMAIL') ?? 'paciente1@clienteapp.test'
const TEST_USER_PASS =
  Deno.env.get('SUPABASE_TEST_USER_PASS') ?? 'local-seed-cgGqBIrprZGocA9r5Jxm'

// ── Seed ID constants (from supabase/seed.sql) ─────────────────────────────────

/** pac1 — Sofía Rodríguez (paciente1@clienteapp.test). Happy-path + parity subject. */
const PAC1_ID = 'd0000001-0000-0000-0000-000000000000'

/** pac2 — Martín López (paciente2@clienteapp.test). Used in nivel_ajeno test (E3). */
const PAC2_ID = 'd0000002-0000-0000-0000-000000000000' // eslint-disable-line @typescript-eslint/no-unused-vars -- referenced indirectly via NIVEL_2_3_ID

/** pac3 — Valentina Torres (paciente3@clienteapp.test). Used in no-IDOR Prop #1(ii). */
const PAC3_ID = 'd0000003-0000-0000-0000-000000000000'

/** pac4 — Sebastián Díaz (paciente4@clienteapp.test). Used in sin_etapa_activa test (E2). */
const PAC4_ID = 'd0000004-0000-0000-0000-000000000000'

/**
 * etapa4 — pac4's active etapa (fecha_inicio 2026-01-26). Used by T7
 * (get_mi_estructura_actual boundary/exclusion/empty test) — pac4 has no
 * mediciones_estructura rows in the seed, so this is the empty precondition.
 */
const ETAPA4_ID = 'e0000004-0000-0000-0000-000000000000'

/** etapa1 — Sofía's active etapa (fecha_inicio 2026-05-05) */
const ETAPA1_ID = 'e0000001-0000-0000-0000-000000000000'

/**
 * v_nivel_1_1 — Sofía's nivel 1.
 * fecha_seguimiento_esperada = 2026-06-05 (vencida); sin nivel_evaluacion → VIGENTE.
 * submit on this id is the reversible happy-path write test (T5).
 */
const NIVEL_1_1_ID = 'f0000001-0000-0000-0000-000000000000'

/**
 * v_nivel_2_3 — Martín's nivel 3 (etapa2, fecha_seguimiento_esperada = 2026-05-15).
 * Belongs to a different paciente; pac1 submitting on it must raise nivel_ajeno (E3).
 */
const NIVEL_2_3_ID = 'f0000007-0000-0000-0000-000000000000'

/** etapa1 fecha_inicio (seed constant) — used by S3 to compute a future week. */
const ETAPA1_INICIO_ISO = '2026-05-05'

/**
 * Seed contenido (video + audio) ids. S3 injects a future-dated entrega using
 * these to exercise the weekly lock (Sofía's real plan has only past weeks).
 * A week's plan is now 2 persistible slots (video + audio) — the frase slot
 * (former orden 3, entregas_plan.frase_id) was retired (frasesAutomaticas/
 * Task 4.1); frases are derived automatically by frases_de_etapa and surface
 * via get_mi_plan_semanal's `frases` array, not via entregas_plan rows.
 */
const SEED_CONTENIDO_VIDEO_ID = 'b1000001-0000-0000-0000-000000000000'
const SEED_CONTENIDO_AUDIO_ID = 'b1000002-0000-0000-0000-000000000000'

/**
 * Blacklisted clinical/internal field names that must never appear in patient
 * RPC projections (Prop #2 / S2). Presence of any of these keys is a data-leak.
 */
const FORBIDDEN_KEYS: readonly string[] = [
  'estado_id',
  'motivo_cambio_estado',
  'activo',
  'fecha_cambio_estado',
  'user_id',
  'notas_diagnostico',
  'motivo_cierre',
  'observaciones',
  'causa_id',
  'algoritmo_id',
  'registrada_por',
  'copiada_de',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function requireEnv(): void {
  const missing: string[] = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL')
  if (!SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY')
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    )
  }
}

function serviceRoleClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Creates an authenticated supabase-js client signed in as the given user.
 * Parameterised (rather than reading globals) so Task 5.2 can reuse it with
 * other seed users (terapeuta, pac4, etc.).
 */
async function authenticatedClient(
  email: string,
  pass: string,
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({
    email,
    password: pass,
  })
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`)
  }
  return client
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`)
  }
}

/**
 * Recursively walks a JSON value and asserts that none of the forbidden keys
 * appear anywhere in the structure (nested objects and arrays included).
 * Used by Prop #2 (S2) to verify no clinical/internal fields leak in RPC output.
 */
function assertNoForbiddenKeys(
  value: unknown,
  forbidden: readonly string[],
  path: string,
): void {
  if (value === null || value === undefined) return
  if (Array.isArray(value)) {
    const arr = value as unknown[]
    arr.forEach((item, i) =>
      assertNoForbiddenKeys(item, forbidden, `${path}[${i}]`),
    )
    return
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      assert(
        !forbidden.includes(key),
        `Forbidden key '${key}' found at ${path}.${key}`,
      )
      assertNoForbiddenKeys(obj[key], forbidden, `${path}.${key}`)
    }
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

/**
 * Deletes the nivel_evaluacion row created by T5 (submit on v_nivel_1_1),
 * restoring Sofía's seed state (no evaluaciones). Best-effort: logs a warning
 * on failure but does not re-throw.
 */
async function fullCleanup(admin: SupabaseClient): Promise<void> {
  console.log('\n[cleanup] Removing submit artifact from nivel_evaluacion...')
  const { error } = await admin
    .from('nivel_evaluacion')
    .delete()
    .eq('nivel_id', NIVEL_1_1_ID)
  if (error) {
    console.warn(
      `[cleanup] Failed to delete nivel_evaluacion row: ${error.message}`,
    )
  } else {
    console.log('[cleanup] Done — seed restored (Sofía: sin evaluaciones).')
  }
}

// ── Error tests (Task 5.2) ────────────────────────────────────────────────────

/**
 * E1 — no_vinculado
 * terapeuta1@clienteapp.test has a valid auth user_id but NO row in public.pacientes.
 * Calling any RPC must return an error whose message includes 'no_vinculado'.
 *
 * supabase-js surfaces Postgres `RAISE EXCEPTION … USING ERRCODE` in error.message.
 */
async function testErrorNoVinculado(): Promise<void> {
  console.log('\n[E1] no_vinculado ───────────────────────────────────────────')

  const terapeuta = await authenticatedClient(
    'terapeuta1@clienteapp.test',
    'local-seed-cgGqBIrprZGocA9r5Jxm',
  )
  const { error } = await terapeuta.rpc('get_mi_perfil')

  assert(
    error !== null,
    '[E1] Expected get_mi_perfil to fail for a non-paciente user, but it succeeded',
  )
  assert(
    error!.message.includes('no_vinculado'),
    `[E1] Expected error.message to include 'no_vinculado', got: ${error?.message}`,
  )
  console.log("  get_mi_perfil error.message includes 'no_vinculado' ✓")

  // get_mi_estructura_actual (medicionEvolutiva) must raise the same
  // no_vinculado gate as the other 5 patient RPCs.
  const { error: estructuraErr } = await terapeuta.rpc(
    'get_mi_estructura_actual',
  )
  assert(
    estructuraErr !== null,
    '[E1] Expected get_mi_estructura_actual to fail for a non-paciente user, but it succeeded',
  )
  assert(
    estructuraErr!.message.includes('no_vinculado'),
    `[E1] Expected get_mi_estructura_actual error.message to include 'no_vinculado', got: ${estructuraErr?.message}`,
  )
  console.log(
    "  get_mi_estructura_actual error.message includes 'no_vinculado' ✓",
  )

  console.log('[E1] PASSED ✓')
}

/**
 * E2 — sin_etapa_activa
 * Uses pac4 (Sebastián Díaz / paciente4@clienteapp.test) — not used in other tests.
 *
 * Procedure:
 *  1. Service-role: set fecha_finalizacion = today on pac4's active etapa.
 *  2. Authenticate as pac4.
 *  3. Assert that all 4 read RPCs + submit_mi_evaluacion raise sin_etapa_activa.
 *  4. try/finally: ALWAYS restore fecha_finalizacion = null; warn loudly on failure.
 */
async function testErrorSinEtapaActiva(admin: SupabaseClient): Promise<void> {
  console.log('\n[E2] sin_etapa_activa ───────────────────────────────────────')

  const todayStr = new Date().toISOString().split('T')[0]

  // Close pac4's active etapa via service-role.
  const { error: closeErr } = await admin
    .from('etapas_tratamiento')
    .update({ fecha_finalizacion: todayStr })
    .eq('paciente_id', PAC4_ID)
    .is('fecha_finalizacion', null)
  assert(
    !closeErr,
    `[E2] Failed to close pac4 etapa (precondition): ${closeErr?.message}`,
  )
  console.log(`  Closed pac4 etapa (fecha_finalizacion = ${todayStr})`)

  const pac4 = await authenticatedClient(
    'paciente4@clienteapp.test',
    'local-seed-cgGqBIrprZGocA9r5Jxm',
  )

  try {
    // get_mi_perfil is NOT etapa-gated: a paciente without an active etapa can
    // still read their profile. It must SUCCEED (perfil no depende de la etapa).
    const { data: perfilData, error: perfilErr } =
      await pac4.rpc('get_mi_perfil')
    assert(
      perfilErr === null,
      `[E2] get_mi_perfil must succeed without an active etapa, got: ${perfilErr?.message}`,
    )
    assert(perfilData !== null, '[E2] get_mi_perfil returned null for pac4')

    // The 4 etapa-dependent read RPCs must raise sin_etapa_activa.
    const etapaGatedReads = [
      'get_mi_tratamiento_activo',
      'get_mi_plan_semanal',
      'get_mi_evaluacion_vigente',
      'get_mi_estructura_actual',
    ] as const
    for (const rpcName of etapaGatedReads) {
      const { error } = await pac4.rpc(rpcName)
      assert(
        error !== null,
        `[E2] ${rpcName} should have raised sin_etapa_activa but succeeded`,
      )
      assert(
        error!.message.includes('sin_etapa_activa'),
        `[E2] ${rpcName}: expected sin_etapa_activa, got: ${error?.message}`,
      )
    }

    // submit_mi_evaluacion must also raise sin_etapa_activa (fires before nivel check).
    const { error: submitErr } = await pac4.rpc('submit_mi_evaluacion', {
      p_nivel_id: NIVEL_1_1_ID,
      p_score_causa: 3,
      p_score_algoritmo: 4,
    })
    assert(
      submitErr !== null,
      '[E2] submit_mi_evaluacion should have raised sin_etapa_activa but succeeded',
    )
    assert(
      submitErr!.message.includes('sin_etapa_activa'),
      `[E2] submit: expected sin_etapa_activa, got: ${submitErr?.message}`,
    )

    console.log(
      '  get_mi_perfil succeeded (not etapa-gated); 4 etapa reads + submit raised sin_etapa_activa ✓',
    )
    console.log('[E2] PASSED ✓')
  } finally {
    // ALWAYS restore pac4's etapa — even if assertions failed above.
    const { error: restoreErr } = await admin
      .from('etapas_tratamiento')
      .update({ fecha_finalizacion: null })
      .eq('paciente_id', PAC4_ID)
    if (restoreErr) {
      console.warn(
        '\n⚠⚠⚠  [E2/cleanup] FAILED TO RESTORE pac4 etapa_tratamiento!' +
          '\n      Manual intervention required:' +
          '\n      UPDATE public.etapas_tratamiento SET fecha_finalizacion = NULL' +
          `\n      WHERE paciente_id = '${PAC4_ID}';` +
          `\n      Supabase error: ${restoreErr.message}\n`,
      )
    } else {
      console.log(
        '  [E2/cleanup] pac4 etapa restored (fecha_finalizacion = null) ✓',
      )
    }
  }
}

/**
 * E3 — nivel_ajeno
 * pac1 (Sofía) submits on NIVEL_2_3_ID which belongs to pac2 (Martín) — a
 * completely different paciente and etapa. The RPC must raise nivel_ajeno.
 */
async function testErrorNivelAjeno(pac1: SupabaseClient): Promise<void> {
  console.log('\n[E3] nivel_ajeno ────────────────────────────────────────────')

  const { error } = await pac1.rpc('submit_mi_evaluacion', {
    p_nivel_id: NIVEL_2_3_ID, // Martín's nivel 3 — belongs to a different etapa
    p_score_causa: 3,
    p_score_algoritmo: 4,
  })

  assert(
    error !== null,
    "[E3] submit on another patient's nivel should have raised nivel_ajeno but succeeded",
  )
  assert(
    error!.message.includes('nivel_ajeno'),
    `[E3] Expected nivel_ajeno, got: ${error?.message}`,
  )

  console.log(
    "  submit on NIVEL_2_3_ID (Martín's) correctly raised nivel_ajeno ✓",
  )
  console.log('[E3] PASSED ✓')
}

/**
 * E4 — score_invalido
 * Verifies two out-of-range cases:
 *   4a. causa = 6  (above 5) with valid algoritmo = 3
 *   4b. causa = 2 (valid) with algoritmo = 0 (below 1)
 *
 * Each call must fail before writing a row. A pre-delete guard is included for
 * safety but should not be necessary if the RPC validates scores before insert.
 */
async function testErrorScoreInvalido(
  pac1: SupabaseClient,
  admin: SupabaseClient,
): Promise<void> {
  console.log('\n[E4] score_invalido ─────────────────────────────────────────')

  // Guard: ensure no stale row on v_nivel_1_1.
  await admin.from('nivel_evaluacion').delete().eq('nivel_id', NIVEL_1_1_ID)

  // Case 4a: causa = 6 (> 5)
  const { error: err4a } = await pac1.rpc('submit_mi_evaluacion', {
    p_nivel_id: NIVEL_1_1_ID,
    p_score_causa: 6,
    p_score_algoritmo: 3,
  })
  assert(
    err4a !== null,
    '[E4a] submit with causa=6 should have raised score_invalido but succeeded',
  )
  assert(
    err4a!.message.includes('score_invalido'),
    `[E4a] Expected score_invalido (causa=6), got: ${err4a?.message}`,
  )
  console.log('  causa=6 → score_invalido ✓')

  // Case 4b: algoritmo = 0 (< 1)
  const { error: err4b } = await pac1.rpc('submit_mi_evaluacion', {
    p_nivel_id: NIVEL_1_1_ID,
    p_score_causa: 2,
    p_score_algoritmo: 0,
  })
  assert(
    err4b !== null,
    '[E4b] submit with algoritmo=0 should have raised score_invalido but succeeded',
  )
  assert(
    err4b!.message.includes('score_invalido'),
    `[E4b] Expected score_invalido (algoritmo=0), got: ${err4b?.message}`,
  )
  console.log('  algoritmo=0 → score_invalido ✓')

  console.log('[E4] PASSED ✓')
}

/**
 * E5 — ya_respondida
 * Submit the same nivel twice. The second call must raise ya_respondida.
 *
 * The test owns its cleanup: try/finally deletes the row created by submit #1.
 * fullCleanup() at suite level is a second safety net.
 */
async function testErrorYaRespondida(
  pac1: SupabaseClient,
  admin: SupabaseClient,
): Promise<void> {
  console.log('\n[E5] ya_respondida ──────────────────────────────────────────')

  // Precondition: ensure no stale row on v_nivel_1_1.
  await admin.from('nivel_evaluacion').delete().eq('nivel_id', NIVEL_1_1_ID)

  try {
    // First submit — must succeed.
    const { data: data1, error: err1 } = await pac1.rpc(
      'submit_mi_evaluacion',
      {
        p_nivel_id: NIVEL_1_1_ID,
        p_score_causa: 3,
        p_score_algoritmo: 4,
      },
    )
    assert(!err1, `[E5] First submit failed unexpectedly: ${err1?.message}`)
    assert(
      (data1 as Record<string, unknown>)?.ok === true,
      `[E5] First submit expected {ok:true}, got ${JSON.stringify(data1)}`,
    )
    console.log('  first submit succeeded ✓')

    // Second submit on the same nivel — must raise ya_respondida.
    const { error: err2 } = await pac1.rpc('submit_mi_evaluacion', {
      p_nivel_id: NIVEL_1_1_ID,
      p_score_causa: 2,
      p_score_algoritmo: 5,
    })
    assert(
      err2 !== null,
      '[E5] Second submit should have failed with ya_respondida but succeeded',
    )
    assert(
      err2!.message.includes('ya_respondida'),
      `[E5] Expected ya_respondida on second submit, got: ${err2?.message}`,
    )
    console.log('  second submit correctly raised ya_respondida ✓')
    console.log('[E5] PASSED ✓')
  } finally {
    // Cleanup: remove the row created by submit #1.
    const { error: cleanErr } = await admin
      .from('nivel_evaluacion')
      .delete()
      .eq('nivel_id', NIVEL_1_1_ID)
    if (cleanErr) {
      console.warn(
        `[E5/cleanup] Failed to delete ya_respondida test row: ${cleanErr.message}`,
      )
    }
  }
}

/**
 * P1 — Paridad get_mi_tratamiento_activo vs mapAsignacionToPaciente
 *
 * Verifies that the four numeric/date derivations computed by the RPC match
 * exactly those computed by the TypeScript mapper used in the web dashboard:
 *
 *   RPC field          ↔  mapper field
 *   nivelActual        ↔  paciente.nivelActual
 *   semanaActual       ↔  paciente.semanaGlobal
 *   semanasTotales     ↔  paciente.semanasTotales
 *   proximaEvaluacion  ↔  paciente.proximaEvaluacion
 *
 * CLOCK: "hoy" es el día de Argentina, igual que public.hoy() en la base (ADR 0012).
 * Residual risk: midnight-rollover between the two remote calls — acceptable per
 * spec (DEC-5-2). The clock is fixed BEFORE the RPC call to minimize the window.
 *
 * SLOPPY IMPORTS NOTE: The mapper source uses extensionless relative imports
 * ('../PacienteTypes', './computeEdad'). Deno requires --unstable-sloppy-imports
 * (or "unstable": ["sloppy-imports"] in deno.json) to resolve these.
 */
async function testParidadTratamientoVsMapper(
  pac1: SupabaseClient,
  admin: SupabaseClient,
): Promise<void> {
  console.log(
    '\n[P1] Paridad get_mi_tratamiento_activo vs mapper ────────────────',
  )

  // Fix the clock before calling the RPC to narrow the rollover window.
  // El día de Argentina espeja public.hoy() (ADR 0012). El mapper lee `today`
  // por sus componentes locales, así que se arma como medianoche local.
  const todayISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
  const [todayY, todayM, todayD] = todayISO.split('-').map(Number)
  const today = new Date(todayY, todayM - 1, todayD)
  console.log(`  today (día de Argentina) = ${todayISO}`)

  // ── 1. RPC call ──────────────────────────────────────────────────────────
  const { data: rpcData, error: rpcErr } = await pac1.rpc(
    'get_mi_tratamiento_activo',
  )
  assert(
    !rpcErr,
    `[P1] get_mi_tratamiento_activo RPC failed: ${rpcErr?.message}`,
  )
  assert(
    rpcData !== null,
    '[P1] Expected non-null data from get_mi_tratamiento_activo',
  )
  const rpc = rpcData as Record<string, unknown>
  console.log(
    `  RPC  → nivelActual=${rpc.nivelActual}, semanaActual=${rpc.semanaActual}, ` +
      `semanasTotales=${rpc.semanasTotales}, proximaEvaluacion=${rpc.proximaEvaluacion}`,
  )

  // ── 2. Fetch raw asignacion for pac1 (exact AsignacionRaw shape) ─────────
  // Mirrors the select string in fetchPacientesByTerapeuta.ts, filtered by
  // paciente_id instead of terapeuta_id (pac1 has exactly one active asignacion).
  const { data: rawAsig, error: asigErr } = await admin
    .from('asignaciones_paciente')
    .select(
      `id, fecha_desde, pacientes ( id, nombre, telefono, email, fecha_nacimiento, fecha_alta, etapas_tratamiento ( id, fecha_inicio, fecha_finalizacion, causas ( nombre, definicion, emociones_esperadas ), modalidades ( cantidad_niveles, cantidad_sesiones, tipos_disco ( nombre ) ), etapa_bloqueos ( bloqueos ( id, nombre ) ), niveles ( id, numero_nivel, fecha_seguimiento_esperada, fecha_seguimiento_real, nivel_evaluacion ( id, score, fecha_respuesta ) ) ) )`,
    )
    .eq('paciente_id', PAC1_ID)
    .is('fecha_hasta', null)
    .single()
  assert(
    !asigErr,
    `[P1] Service-role asignacion fetch failed: ${asigErr?.message}`,
  )
  assert(rawAsig !== null, '[P1] Expected non-null asignacion row for pac1')

  // ── 3. Run the real mapper with the same fixed clock ─────────────────────
  const paciente = mapAsignacionToPaciente(
    rawAsig as unknown as AsignacionRaw,
    today,
  )
  console.log(
    `  Mapper → nivelActual=${paciente.nivelActual}, semanaGlobal=${paciente.semanaGlobal}, ` +
      `semanasTotales=${paciente.semanasTotales}, proximaEvaluacion=${paciente.proximaEvaluacion}`,
  )

  // ── 4. Assert exact parity ────────────────────────────────────────────────
  assert(
    rpc.nivelActual === paciente.nivelActual,
    `[P1] nivelActual mismatch: RPC=${rpc.nivelActual} vs mapper=${paciente.nivelActual}`,
  )
  assert(
    rpc.semanaActual === paciente.semanaGlobal,
    `[P1] semanaActual/semanaGlobal mismatch: RPC.semanaActual=${rpc.semanaActual} vs mapper.semanaGlobal=${paciente.semanaGlobal}`,
  )
  assert(
    rpc.semanasTotales === paciente.semanasTotales,
    `[P1] semanasTotales mismatch: RPC=${rpc.semanasTotales} vs mapper=${paciente.semanasTotales}`,
  )
  assert(
    rpc.proximaEvaluacion === paciente.proximaEvaluacion,
    `[P1] proximaEvaluacion mismatch: RPC=${rpc.proximaEvaluacion} vs mapper=${paciente.proximaEvaluacion}`,
  )

  console.log('  all 4 derived values match exactly ✓')
  console.log('[P1] PASSED ✓')
}

// ── T1: get_mi_perfil ─────────────────────────────────────────────────────────

async function testGetMiPerfil(pac1: SupabaseClient): Promise<void> {
  console.log('\n[T1] get_mi_perfil ──────────────────────────────────────────')

  const { data, error } = await pac1.rpc('get_mi_perfil')
  assert(!error, `[T1] RPC failed: ${error?.message}`)
  assert(data !== null, '[T1] Expected non-null data from get_mi_perfil')

  const perfil = data as Record<string, unknown>

  // Shape: 9 camelCase keys.
  const expectedKeys = [
    'nombre',
    'telefono',
    'email',
    'contactoAlternativo',
    'relacionContacto',
    'fechaNacimiento',
    'fechaAlta',
    'edad',
    'estado',
  ]
  for (const key of expectedKeys) {
    assert(
      key in perfil,
      `[T1] Missing key '${key}' in get_mi_perfil response: ${JSON.stringify(perfil)}`,
    )
  }

  // Specific values.
  // Note: pacientes.email (sofia.rodriguez@paciente.test) differs from auth email
  // (paciente1@clienteapp.test). The RPC projects pacientes.email — see file header.
  assert(
    perfil.email === 'sofia.rodriguez@paciente.test',
    `[T1] Expected email='sofia.rodriguez@paciente.test', got '${perfil.email}'`,
  )
  assert(
    perfil.estado === 'activo',
    `[T1] Expected estado='activo', got '${perfil.estado}'`,
  )
  assert(
    typeof perfil.edad === 'number',
    `[T1] Expected edad to be numeric, got ${typeof perfil.edad} (${perfil.edad})`,
  )
  assert(
    (perfil.edad as number) > 0,
    `[T1] Expected edad > 0, got ${perfil.edad}`,
  )

  console.log(
    `  nombre: ${perfil.nombre}, edad: ${perfil.edad}, estado: ${perfil.estado} ✓`,
  )
  console.log('[T1] PASSED ✓')
}

// ── T2: get_mi_tratamiento_activo ─────────────────────────────────────────────

async function testGetMiTratamientoActivo(pac1: SupabaseClient): Promise<void> {
  console.log(
    '\n[T2] get_mi_tratamiento_activo ──────────────────────────────────',
  )

  const { data, error } = await pac1.rpc('get_mi_tratamiento_activo')
  assert(!error, `[T2] RPC failed: ${error?.message}`)
  assert(
    data !== null,
    '[T2] Expected non-null data from get_mi_tratamiento_activo',
  )

  const trat = data as Record<string, unknown>

  // Shape: 7 camelCase keys.
  const expectedKeys = [
    'nivelActual',
    'nivelesTotales',
    'semanaActual',
    'semanasTotales',
    'fechaInicio',
    'proximaEvaluacion',
    'estado',
  ]
  for (const key of expectedKeys) {
    assert(
      key in trat,
      `[T2] Missing key '${key}' in get_mi_tratamiento_activo response: ${JSON.stringify(trat)}`,
    )
  }

  // Specific derivations (seed-stable values).
  assert(
    trat.nivelActual === 1,
    `[T2] Expected nivelActual=1 (nivel 1 is the first without fecha_seguimiento_real), got ${trat.nivelActual}`,
  )
  assert(
    trat.nivelesTotales === 4,
    `[T2] Expected nivelesTotales=4, got ${trat.nivelesTotales}`,
  )
  // fechaInicio = '2026-05-05' (date as string in jsonb).
  assert(
    typeof trat.fechaInicio === 'string' &&
      (trat.fechaInicio as string).startsWith('2026-05-05'),
    `[T2] Expected fechaInicio starting '2026-05-05', got ${trat.fechaInicio}`,
  )
  // proximaEvaluacion: min(fecha_seguimiento_esperada) > public.hoy().
  // As of authoring (2026-06-30): nivel 1 is vencida, so proxima = '2026-07-05'.
  // Not hard-coded here (execution deferred; exact value depends on run date).
  assert(
    trat.proximaEvaluacion !== null && trat.proximaEvaluacion !== undefined,
    `[T2] Expected proximaEvaluacion to be non-null (niveles 2-4 are in the future)`,
  )
  assert(
    typeof trat.proximaEvaluacion === 'string',
    `[T2] Expected proximaEvaluacion to be a string date, got ${typeof trat.proximaEvaluacion}`,
  )

  console.log(
    `  nivelActual=${trat.nivelActual}, nivelesTotales=${trat.nivelesTotales}, ` +
      `semanaActual=${trat.semanaActual}, semanasTotales=${trat.semanasTotales}, ` +
      `proximaEvaluacion=${trat.proximaEvaluacion} ✓`,
  )
  console.log('[T2] PASSED ✓')
}

// ── T3: get_mi_plan_semanal ───────────────────────────────────────────────────

async function testGetMiPlanSemanal(pac1: SupabaseClient): Promise<void> {
  console.log('\n[T3] get_mi_plan_semanal ────────────────────────────────────')

  const { data, error } = await pac1.rpc('get_mi_plan_semanal')
  assert(!error, `[T3] RPC failed: ${error?.message}`)
  assert(data !== null, '[T3] Expected non-null data from get_mi_plan_semanal')

  // Must be an array (etapa1 has entregas_plan rows).
  assert(
    Array.isArray(data),
    `[T3] Expected array from get_mi_plan_semanal, got ${typeof data}`,
  )
  const semanas = data as Array<Record<string, unknown>>
  assert(
    semanas.length > 0,
    `[T3] Expected at least one semana in the plan (etapa1 has entregas_plan), got 0`,
  )

  // Shape of each element. The scalar `frase` key (deprecated) no longer
  // exists in the contract — frases now come back as a `frases` array
  // (frasesAutomaticas/Task 2.2): [{ orden, origen, texto }], [] if futura.
  const expectedKeys = [
    'semana',
    'estadoSemana',
    'fechaDesbloqueo',
    'piezas',
    'frases',
  ]
  for (let i = 0; i < semanas.length; i++) {
    const s = semanas[i]
    for (const key of expectedKeys) {
      assert(
        key in s,
        `[T3] semana[${i}] missing key '${key}': ${JSON.stringify(s)}`,
      )
    }
    // piezas must be an array.
    assert(
      Array.isArray(s.piezas),
      `[T3] semana[${i}].piezas must be an array, got ${typeof s.piezas}`,
    )
    // frases must be an array (of { orden, origen, texto } objects, or []).
    assert(
      Array.isArray(s.frases),
      `[T3] semana[${i}].frases must be an array, got ${typeof s.frases}`,
    )
    // estadoSemana must be one of the three valid values.
    const validEstados = ['futura', 'actual', 'anterior']
    assert(
      validEstados.includes(s.estadoSemana as string),
      `[T3] semana[${i}].estadoSemana='${s.estadoSemana}' not in ${JSON.stringify(validEstados)}`,
    )
  }

  console.log(`  ${semanas.length} semana(s) returned; shape validated ✓`)
  console.log('[T3] PASSED ✓')
}

// ── T4: get_mi_evaluacion_vigente ─────────────────────────────────────────────

async function testGetMiEvaluacionVigente(pac1: SupabaseClient): Promise<void> {
  console.log(
    '\n[T4] get_mi_evaluacion_vigente ──────────────────────────────────',
  )

  const { data, error } = await pac1.rpc('get_mi_evaluacion_vigente')
  assert(!error, `[T4] RPC failed: ${error?.message}`)
  assert(
    data !== null,
    '[T4] Expected non-null data from get_mi_evaluacion_vigente',
  )

  const ev = data as Record<string, unknown>

  // Nivel 1 of Sofía: fecha_seguimiento_esperada=2026-06-05 ≤ today; no nivel_evaluacion
  // → vigente must be true.
  assert(
    ev.vigente === true,
    `[T4] Expected vigente=true (nivel 1 vencida, sin evaluación), got vigente=${ev.vigente}`,
  )

  // nivelId must be v_nivel_1_1.
  assert(
    ev.nivelId === NIVEL_1_1_ID,
    `[T4] Expected nivelId='${NIVEL_1_1_ID}', got '${ev.nivelId}'`,
  )

  // resultadoEsperado must have causa and algoritmo keys.
  assert(
    ev.resultadoEsperado !== null &&
      ev.resultadoEsperado !== undefined &&
      typeof ev.resultadoEsperado === 'object',
    `[T4] Expected resultadoEsperado to be an object, got ${typeof ev.resultadoEsperado}`,
  )
  const res = ev.resultadoEsperado as Record<string, unknown>
  assert(
    'causa' in res,
    `[T4] resultadoEsperado missing 'causa' key: ${JSON.stringify(res)}`,
  )
  assert(
    'algoritmo' in res,
    `[T4] resultadoEsperado missing 'algoritmo' key: ${JSON.stringify(res)}`,
  )
  // The frases may be null if catalog rows are missing (acceptable per RPC spec),
  // but both keys must be present.
  console.log(`  vigente=true, nivelId=${ev.nivelId}`)
  console.log(
    `  resultadoEsperado.causa=${JSON.stringify(res.causa)}, algoritmo=${JSON.stringify(res.algoritmo)} ✓`,
  )
  console.log('[T4] PASSED ✓')
}

// ── T5: submit_mi_evaluacion ──────────────────────────────────────────────────

async function testSubmitMiEvaluacion(
  pac1: SupabaseClient,
  admin: SupabaseClient,
): Promise<void> {
  console.log(
    '\n[T5] submit_mi_evaluacion ───────────────────────────────────────',
  )

  // Precondition: ensure no stale nivel_evaluacion row from a previous run.
  // (best-effort; ignore errors)
  await admin.from('nivel_evaluacion').delete().eq('nivel_id', NIVEL_1_1_ID)

  // Submit: causa=3, algoritmo=4 → expected score = (3+4)/2.0 = 3.5
  const { data, error } = await pac1.rpc('submit_mi_evaluacion', {
    p_nivel_id: NIVEL_1_1_ID,
    p_score_causa: 3,
    p_score_algoritmo: 4,
  })
  assert(!error, `[T5] submit_mi_evaluacion RPC failed: ${error?.message}`)
  assert(data !== null, '[T5] Expected non-null data from submit_mi_evaluacion')

  const result = data as Record<string, unknown>
  assert(
    result.ok === true,
    `[T5] Expected { ok: true }, got ${JSON.stringify(result)}`,
  )
  console.log('  submit returned { ok: true } ✓')

  // Verify persisted score via service-role read.
  const { data: rows, error: readErr } = await admin
    .from('nivel_evaluacion')
    .select('score, fecha_respuesta')
    .eq('nivel_id', NIVEL_1_1_ID)
    .limit(1)
  assert(!readErr, `[T5] Service-role read failed: ${readErr?.message}`)
  assert(
    rows !== null && (rows as unknown[]).length === 1,
    `[T5] Expected exactly 1 nivel_evaluacion row, got ${(rows as unknown[])?.length ?? 0}`,
  )

  const row = (rows as Array<{ score: number; fecha_respuesta: string }>)[0]
  // score is numeric(2,1) → JS number 3.5 (not integer division).
  assert(
    row.score === 3.5,
    `[T5] Expected score=3.5, got ${row.score} (type: ${typeof row.score})`,
  )
  console.log(`  service-role read: score=${row.score} ✓`)

  console.log('[T5] PASSED ✓')
}

// ── T6/T7: get_mi_estructura_actual (medicionEvolutiva) ──────────────────────

/**
 * T6 — get_mi_estructura_actual happy path (pac1 — Sofía, seed fixture 1).
 *
 * Seed (supabase/seed.sql, medir-chakras fixture 1): apertura (estructura=40)
 * at 2026-05-05T10:00:00Z, seguimiento (48) at 2026-06-05T10:00:00Z,
 * seguimiento (55) at 2026-07-05T10:00:00Z — 12 active centros per reading,
 * each center's valor === that reading's estructuraGeneral. 10:00Z is 07:00
 * in America/Argentina/Buenos_Aires (UTC-3), so fecha stays on the same
 * calendar day as the UTC date for all three rows.
 */
async function testGetMiEstructuraActualHappyPath(
  pac1: SupabaseClient,
): Promise<void> {
  console.log(
    '\n[T6] get_mi_estructura_actual (happy path) ─────────────────────',
  )

  const { data, error } = await pac1.rpc('get_mi_estructura_actual')
  assert(!error, `[T6] RPC failed: ${error?.message}`)
  assert(
    data !== null,
    '[T6] Expected non-null data from get_mi_estructura_actual',
  )

  const result = data as Record<string, unknown>
  assert(
    'mediciones' in result,
    `[T6] Missing key 'mediciones' in response: ${JSON.stringify(result)}`,
  )
  assert(
    Array.isArray(result.mediciones),
    `[T6] Expected mediciones to be an array, got ${typeof result.mediciones}`,
  )

  const mediciones = result.mediciones as Array<Record<string, unknown>>
  assert(
    mediciones.length === 3,
    `[T6] Expected 3 mediciones (apertura + 2 seguimiento), got ${mediciones.length}`,
  )

  const expectedFechas = ['2026-05-05', '2026-06-05', '2026-07-05']
  const expectedMomentos = ['apertura', 'seguimiento', 'seguimiento']
  const expectedEstructura = [40, 48, 55]
  const medicionKeys = [
    'id',
    'fecha',
    'momento',
    'estructuraGeneral',
    'valores',
  ]
  const valorKeys = ['codigo', 'etiquetaPaciente', 'orden', 'valor']

  for (let i = 0; i < mediciones.length; i++) {
    const m = mediciones[i]

    // Exact key set per medicion (S2 covers the forbidden-keys sweep separately).
    assert(
      Object.keys(m).sort().join(',') === [...medicionKeys].sort().join(','),
      `[T6] mediciones[${i}] key set mismatch: got ${JSON.stringify(Object.keys(m))}`,
    )
    assert(
      m.fecha === expectedFechas[i],
      `[T6] mediciones[${i}].fecha expected '${expectedFechas[i]}', got '${m.fecha}'`,
    )
    assert(
      m.momento === expectedMomentos[i],
      `[T6] mediciones[${i}].momento expected '${expectedMomentos[i]}', got '${m.momento}'`,
    )
    assert(
      m.estructuraGeneral === expectedEstructura[i],
      `[T6] mediciones[${i}].estructuraGeneral expected ${expectedEstructura[i]}, got ${m.estructuraGeneral}`,
    )

    const valores = m.valores as Array<Record<string, unknown>>
    assert(
      Array.isArray(valores) && valores.length === 12,
      `[T6] mediciones[${i}].valores expected 12 entries, got ${valores?.length}`,
    )
    for (let j = 0; j < valores.length; j++) {
      const v = valores[j]
      assert(
        Object.keys(v).sort().join(',') === [...valorKeys].sort().join(','),
        `[T6] mediciones[${i}].valores[${j}] key set mismatch: got ${JSON.stringify(Object.keys(v))}`,
      )
      assert(
        v.orden === j + 1,
        `[T6] mediciones[${i}].valores[${j}].orden expected ${j + 1} (ordered by orden), got ${v.orden}`,
      )
      assert(
        v.valor === expectedEstructura[i],
        `[T6] mediciones[${i}].valores[${j}].valor expected ${expectedEstructura[i]} (seed sets every center = estructuraGeneral), got ${v.valor}`,
      )
    }
  }

  console.log(
    `  3 mediciones (fechas ${expectedFechas.join('/')}, momentos ${expectedMomentos.join('/')}) — each with 12 ordered valores ✓`,
  )
  console.log('[T6] PASSED ✓')
}

/**
 * T7 — get_mi_estructura_actual boundary + exclusion + empty (pac4 — Sebastián).
 *
 * Precondition: pac4 has NO mediciones_estructura rows in the seed
 * ({ mediciones: [] }) — asserted before injecting anything.
 *
 * Injects 3 rows via service-role on pac4's active etapa (ETAPA4_ID) with
 * EXPLICIT registrada_en (a PostgREST batch insert would otherwise share one
 * now()):
 *   apertura            2026-08-01T02:30:00Z → fecha '2026-07-31' (BA UTC-3: 23:30 the prior day)
 *   seguimiento         2026-08-01T03:30:00Z → fecha '2026-08-01' (BA UTC-3: 00:30 the next day)
 *   cierre_automatico   2026-08-02T12:00:00Z, registrada_por = null,
 *                       copiada_de = the seguimiento row's id
 * The seguimiento row is inserted BEFORE cierre_automatico so its id is
 * captured for copiada_de — mirroring _generar_cierre_automatico's real
 * clone-the-last-reading behavior. One medicion_valores row per reading
 * exercises the valores join end to end.
 *
 * Assertion: the RPC returns exactly 2 items (apertura + seguimiento) with
 * those two fechas, in that order — cierre_automatico is excluded (DEC-M06).
 *
 * Cleanup (`finally`): delete medicion_valores then mediciones_estructura by
 * etapa_id (one statement each), loud warn on failure (E2 pattern).
 */
async function testGetMiEstructuraActualBoundaryYVacio(
  admin: SupabaseClient,
): Promise<void> {
  console.log(
    '\n[T7] get_mi_estructura_actual (boundary + exclusion + empty) ────',
  )

  const pac4 = await authenticatedClient(
    'paciente4@clienteapp.test',
    'local-seed-cgGqBIrprZGocA9r5Jxm',
  )

  // Precondition: pac4 has no mediciones_estructura rows yet.
  const { data: emptyData, error: emptyErr } = await pac4.rpc(
    'get_mi_estructura_actual',
  )
  assert(!emptyErr, `[T7] Precondition RPC failed: ${emptyErr?.message}`)
  const emptyResult = emptyData as Record<string, unknown>
  assert(
    Array.isArray(emptyResult.mediciones) &&
      (emptyResult.mediciones as unknown[]).length === 0,
    `[T7] Precondition expected { mediciones: [] }, got ${JSON.stringify(emptyResult)}`,
  )
  console.log('  precondition: pac4 has { mediciones: [] } ✓')

  // centros_energeticos.id is gen_random_uuid() at seed time — not hardcodable.
  const { data: centroRow, error: centroErr } = await admin
    .from('centros_energeticos')
    .select('id')
    .eq('codigo', 'corona')
    .single()
  assert(!centroErr, `[T7] Failed to fetch a centro_id: ${centroErr?.message}`)
  const centroId = (centroRow as { id: string }).id

  // Laura Martínez (MT-0002) — same terapeuta profile used by the seed's own
  // structure fixtures (fixture 1, supabase/seed.sql).
  const LAURA_TERAPEUTA_ID = 'c0000003-0000-0000-0000-000000000000'

  let aperturaId: string | undefined
  let seguimientoId: string | undefined
  let cierreId: string | undefined

  try {
    const { data: apRow, error: apErr } = await admin
      .from('mediciones_estructura')
      .insert({
        etapa_id: ETAPA4_ID,
        momento: 'apertura',
        estructura_general: 50,
        registrada_en: '2026-08-01T02:30:00Z',
        registrada_por: LAURA_TERAPEUTA_ID,
      })
      .select('id')
      .single()
    assert(!apErr, `[T7] Failed to insert apertura row: ${apErr?.message}`)
    aperturaId = (apRow as { id: string }).id

    // Inserted BEFORE cierre_automatico so its id feeds copiada_de below.
    const { data: segRow, error: segErr } = await admin
      .from('mediciones_estructura')
      .insert({
        etapa_id: ETAPA4_ID,
        momento: 'seguimiento',
        estructura_general: 55,
        registrada_en: '2026-08-01T03:30:00Z',
        registrada_por: LAURA_TERAPEUTA_ID,
      })
      .select('id')
      .single()
    assert(!segErr, `[T7] Failed to insert seguimiento row: ${segErr?.message}`)
    seguimientoId = (segRow as { id: string }).id

    const { data: cierreRow, error: cierreErr } = await admin
      .from('mediciones_estructura')
      .insert({
        etapa_id: ETAPA4_ID,
        momento: 'cierre_automatico',
        estructura_general: 55,
        registrada_en: '2026-08-02T12:00:00Z',
        registrada_por: null,
        copiada_de: seguimientoId,
      })
      .select('id')
      .single()
    assert(
      !cierreErr,
      `[T7] Failed to insert cierre_automatico row: ${cierreErr?.message}`,
    )
    cierreId = (cierreRow as { id: string }).id

    const { error: valoresErr } = await admin.from('medicion_valores').insert([
      { medicion_id: aperturaId, centro_id: centroId, valor: 50 },
      { medicion_id: seguimientoId, centro_id: centroId, valor: 55 },
      { medicion_id: cierreId, centro_id: centroId, valor: 55 },
    ])
    assert(
      !valoresErr,
      `[T7] Failed to insert medicion_valores rows: ${valoresErr?.message}`,
    )

    console.log(
      `  injected apertura/seguimiento/cierre_automatico rows (etapa ${ETAPA4_ID})`,
    )

    const { data, error } = await pac4.rpc('get_mi_estructura_actual')
    assert(!error, `[T7] RPC failed: ${error?.message}`)
    const result = data as Record<string, unknown>
    const mediciones = result.mediciones as Array<Record<string, unknown>>

    assert(
      Array.isArray(mediciones) && mediciones.length === 2,
      `[T7] Expected 2 mediciones (cierre_automatico excluded), got ${mediciones?.length}`,
    )
    assert(
      mediciones[0].fecha === '2026-07-31',
      `[T7] mediciones[0].fecha expected '2026-07-31' (BA boundary), got '${mediciones[0].fecha}'`,
    )
    assert(
      mediciones[0].momento === 'apertura',
      `[T7] mediciones[0].momento expected 'apertura', got '${mediciones[0].momento}'`,
    )
    assert(
      mediciones[1].fecha === '2026-08-01',
      `[T7] mediciones[1].fecha expected '2026-08-01' (BA boundary), got '${mediciones[1].fecha}'`,
    )
    assert(
      mediciones[1].momento === 'seguimiento',
      `[T7] mediciones[1].momento expected 'seguimiento', got '${mediciones[1].momento}'`,
    )
    assert(
      mediciones.every((m) => m.momento !== 'cierre_automatico'),
      `[T7] cierre_automatico must never appear (DEC-M06), got ${JSON.stringify(mediciones)}`,
    )

    console.log(
      "  2 items returned (fechas '2026-07-31'/'2026-08-01'), cierre_automatico excluded ✓",
    )
    console.log('[T7] PASSED ✓')
  } finally {
    // Cleanup: delete valores then mediciones by etapa_id — ALWAYS, even if
    // assertions failed above.
    const injectedIds = [aperturaId, seguimientoId, cierreId].filter(
      (id): id is string => id !== undefined,
    )
    const { error: delValoresErr } = await admin
      .from('medicion_valores')
      .delete()
      .in('medicion_id', injectedIds)
    if (delValoresErr) {
      console.warn(
        `\n⚠  [T7/cleanup] FAILED to delete injected medicion_valores: ${delValoresErr.message}`,
      )
    }

    const { error: delMedicionesErr } = await admin
      .from('mediciones_estructura')
      .delete()
      .eq('etapa_id', ETAPA4_ID)
    if (delMedicionesErr) {
      console.warn(
        `\n⚠  [T7/cleanup] FAILED to delete injected mediciones_estructura (etapa ${ETAPA4_ID}): ${delMedicionesErr.message}`,
      )
    } else {
      console.log('  [T7/cleanup] injected mediciones_estructura removed ✓')
    }
  }
}

// ── Security property tests (Task 5.3) ───────────────────────────────────────

/**
 * S1 — no IDOR / no pacienteId injection (two-pronged)
 *
 * (i)  As pac1, confirm each read RPC returns pac1's own data by asserting
 *      identity-linked values: contact email (get_mi_perfil), nivelActual=1
 *      (get_mi_tratamiento_activo), a non-empty plan (get_mi_plan_semanal), and
 *      nivelId === NIVEL_1_1_ID (get_mi_evaluacion_vigente).
 * (ii) Attempt rpc('get_mi_perfil', { p_paciente_id: '<pac3/Valentina>' }).
 *      The function has no such parameter; Postgres must reject the call, proving
 *      a caller cannot inject a foreign paciente id to read someone else's data.
 */
async function testPropNoIDOR(pac1: SupabaseClient): Promise<void> {
  console.log(
    '\n[S1] Prop #1 — no IDOR / no pacienteId injection ───────────────',
  )

  // (i-a) get_mi_perfil: contact email must be pac1's (pacientes.email, not auth email).
  const { data: perfil, error: perfilErr } = await pac1.rpc('get_mi_perfil')
  assert(!perfilErr, `[S1i] get_mi_perfil failed: ${perfilErr?.message}`)
  const perfilData = perfil as Record<string, unknown>
  assert(
    perfilData.email === 'sofia.rodriguez@paciente.test',
    `[S1i] get_mi_perfil.email expected 'sofia.rodriguez@paciente.test' (pac1's contact email), got '${perfilData.email}'`,
  )
  console.log(
    "  (i-a) get_mi_perfil.email === 'sofia.rodriguez@paciente.test' ✓",
  )

  // (i-b) get_mi_tratamiento_activo: nivelActual must be 1 (pac1's seed state).
  const { data: trat, error: tratErr } = await pac1.rpc(
    'get_mi_tratamiento_activo',
  )
  assert(
    !tratErr,
    `[S1i] get_mi_tratamiento_activo failed: ${tratErr?.message}`,
  )
  const tratData = trat as Record<string, unknown>
  assert(
    tratData.nivelActual === 1,
    `[S1i] get_mi_tratamiento_activo.nivelActual expected 1 (pac1's seed state), got ${tratData.nivelActual}`,
  )
  console.log(
    '  (i-b) get_mi_tratamiento_activo.nivelActual === 1 (pac1 data) ✓',
  )

  // (i-c) get_mi_plan_semanal: must return a non-empty array (pac1 has an active plan).
  const { data: plan, error: planErr } = await pac1.rpc('get_mi_plan_semanal')
  assert(!planErr, `[S1i] get_mi_plan_semanal failed: ${planErr?.message}`)
  assert(
    Array.isArray(plan) && (plan as unknown[]).length > 0,
    `[S1i] get_mi_plan_semanal expected non-empty array (pac1 has an active etapa plan), got ${JSON.stringify(plan)?.slice(0, 80)}`,
  )
  console.log(
    `  (i-c) get_mi_plan_semanal returned ${(plan as unknown[]).length} week(s) (pac1 data) ✓`,
  )

  // (i-d) get_mi_evaluacion_vigente: nivelId must be pac1's nivel 1.
  const { data: evVig, error: evVigErr } = await pac1.rpc(
    'get_mi_evaluacion_vigente',
  )
  assert(
    !evVigErr,
    `[S1i] get_mi_evaluacion_vigente failed: ${evVigErr?.message}`,
  )
  const evData = evVig as Record<string, unknown>
  assert(
    evData.nivelId === NIVEL_1_1_ID,
    `[S1i] get_mi_evaluacion_vigente.nivelId expected '${NIVEL_1_1_ID}' (pac1's nivel 1), got '${evData.nivelId}'`,
  )
  console.log(
    `  (i-d) get_mi_evaluacion_vigente.nivelId === ${NIVEL_1_1_ID} (pac1 data) ✓`,
  )

  // (ii) Attempt to inject p_paciente_id (Valentina / pac3) into get_mi_perfil.
  // The function has no such overload; Postgres must return an error.
  const { error: injectErr } = await pac1.rpc('get_mi_perfil', {
    p_paciente_id: PAC3_ID,
  } as Record<string, unknown>)
  assert(
    injectErr !== null,
    `[S1ii] rpc('get_mi_perfil', {p_paciente_id}) was expected to error (no overload accepts a paciente id), but it succeeded`,
  )
  console.log(
    `  (ii) p_paciente_id injection correctly rejected: '${(injectErr?.message ?? '').slice(0, 80)}' ✓`,
  )

  console.log('[S1] PASSED ✓')
}

/**
 * S2 — 0 clinical/internal fields in projections
 *
 * Calls each of the 5 read RPCs and recursively walks the returned JSON
 * (including nested piezas in get_mi_plan_semanal) through assertNoForbiddenKeys,
 * checking that no blacklisted key from FORBIDDEN_KEYS appears anywhere in the
 * output. A match means a clinical/internal field is leaking to the patient.
 */
async function testPropNoForbiddenKeys(pac1: SupabaseClient): Promise<void> {
  console.log(
    '\n[S2] Prop #2 — 0 clinical/internal fields in projections ────────',
  )

  const readRpcs: readonly string[] = [
    'get_mi_perfil',
    'get_mi_tratamiento_activo',
    'get_mi_plan_semanal',
    'get_mi_evaluacion_vigente',
    'get_mi_estructura_actual',
  ]

  for (const rpcName of readRpcs) {
    const { data, error } = await pac1.rpc(rpcName)
    assert(!error, `[S2] ${rpcName} failed: ${error?.message}`)
    assertNoForbiddenKeys(data, FORBIDDEN_KEYS, rpcName)
    console.log(`  ${rpcName}: 0 forbidden keys ✓`)
  }

  console.log('[S2] PASSED ✓')
}

/**
 * S3 — weekly lock
 *
 * From get_mi_plan_semanal() of pac1, finds ≥1 week with estadoSemana === 'futura'
 * and asserts that:
 *   - the week's frases === [] (no motivational phrases revealed early), and
 *   - every pieza in the week has recursoRef === null (content locked).
 *
 * pac1's etapa1 starts 2026-05-05; weeks sufficiently ahead of today (2026-06-30)
 * are 'futura'. This guarantees the lock mechanism is functioning end-to-end.
 */
async function testPropWeeklyLock(
  pac1: SupabaseClient,
  admin: SupabaseClient,
): Promise<void> {
  console.log(
    '\n[S3] Prop #3 — weekly lock: futura weeks are sealed ────────────',
  )

  // Sofía's seed plan (etapa1) only spans past weeks, so there is no 'futura'
  // week to observe the lock on. Inject one via service-role: the 2 persistible
  // slots of a week (video orden 1 + audio orden 2 — frasesAutomaticas/Task 2.1)
  // ~12 weeks ahead of today, then remove it after. Frases themselves are never
  // stored in entregas_plan (they are derived by frases_de_etapa), so the
  // `frases` array on the futura week is expected to be [] purely from the
  // estadoSemana='futura' nulling rule, independent of this injection.
  const inicio = new Date(ETAPA1_INICIO_ISO + 'T00:00:00.000Z')
  const daysElapsed = Math.floor((Date.now() - inicio.getTime()) / 86400000)
  const futureSemana = Math.floor(daysElapsed / 7) + 12 // guaranteed ahead of today
  const futureOffset = (futureSemana - 1) * 7

  const { error: insErr } = await admin.from('entregas_plan').insert([
    {
      etapa_id: ETAPA1_ID,
      dia_offset: futureOffset,
      contenido_id: SEED_CONTENIDO_VIDEO_ID,
      orden: 1,
    },
    {
      etapa_id: ETAPA1_ID,
      dia_offset: futureOffset,
      contenido_id: SEED_CONTENIDO_AUDIO_ID,
      orden: 2,
    },
  ])
  assert(
    !insErr,
    `[S3] Failed to inject future-week entregas: ${insErr?.message}`,
  )
  console.log(
    `  Injected future week ${futureSemana} (dia_offset ${futureOffset}) via service-role`,
  )

  try {
    const { data, error } = await pac1.rpc('get_mi_plan_semanal')
    assert(!error, `[S3] get_mi_plan_semanal failed: ${error?.message}`)
    assert(
      Array.isArray(data),
      `[S3] Expected array from get_mi_plan_semanal, got ${typeof data}`,
    )

    const semanas = data as Array<Record<string, unknown>>
    const futuras = semanas.filter((s) => s.estadoSemana === 'futura')

    assert(
      futuras.length >= 1,
      `[S3] Expected ≥1 'futura' week after injecting week ${futureSemana}, got 0`,
    )
    console.log(`  Found ${futuras.length} 'futura' week(s)`)

    for (let i = 0; i < futuras.length; i++) {
      const semana = futuras[i]

      // Week-level frases must be [] for future weeks (no phrases revealed early).
      assert(
        Array.isArray(semana.frases) &&
          (semana.frases as unknown[]).length === 0,
        `[S3] futura semana[${i}] (semana=${semana.semana}): expected frases=[], got ${JSON.stringify(semana.frases)}`,
      )

      // Every pieza in a future week must have recursoRef=null (resource locked).
      const piezas = semana.piezas as Array<Record<string, unknown>>
      assert(
        Array.isArray(piezas),
        `[S3] futura semana[${i}].piezas must be an array`,
      )
      for (let j = 0; j < piezas.length; j++) {
        assert(
          piezas[j].recursoRef === null,
          `[S3] futura semana[${i}].piezas[${j}].recursoRef expected null, got ${JSON.stringify(piezas[j].recursoRef)}`,
        )
      }
      console.log(
        `  semana[${i}] (semana=${semana.semana}): frases=[], all ${piezas.length} piezas.recursoRef=null ✓`,
      )
    }

    console.log('[S3] PASSED ✓')
  } finally {
    // ALWAYS remove the injected rows, even if assertions failed.
    const { error: delErr } = await admin
      .from('entregas_plan')
      .delete()
      .eq('etapa_id', ETAPA1_ID)
      .eq('dia_offset', futureOffset)
    if (delErr) {
      console.warn(
        `\n⚠  [S3/cleanup] FAILED to delete injected entregas (etapa ${ETAPA1_ID}, dia_offset ${futureOffset}): ${delErr.message}`,
      )
    } else {
      console.log('  [S3/cleanup] injected future-week entregas removed ✓')
    }
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  patient-rpcs — Contract tests for the 6 patient RPCs')
  console.log('  DevSpec Epic 5 / Tasks 5.1–5.3 — Go/No-Go gate (D-7)')
  console.log('  medicionEvolutiva Phase 0: get_mi_estructura_actual (T6–T7)')
  console.log('  Task 5.1: happy paths (T1–T5)')
  console.log('  Task 5.2: error codes (E1–E5) + parity (P1)')
  console.log('  Task 5.3: security properties (S1–S3)')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Primary subject: Sofía Rodríguez (pac1)`)
  console.log(`  Auth email: ${TEST_USER_EMAIL}`)
  console.log(`  etapa1: ${ETAPA1_ID} (inicio 2026-05-05, CAU-02/ALG-03)`)
  console.log(`  nivel 1 (vigente): ${NIVEL_1_1_ID}`)
  console.log('═══════════════════════════════════════════════════════════════')

  requireEnv()

  const admin = serviceRoleClient()

  // Authenticate pac1 (Sofía) — used for all 5 RPC calls.
  let pac1: SupabaseClient
  try {
    pac1 = await authenticatedClient(TEST_USER_EMAIL, TEST_USER_PASS)
  } catch (err) {
    console.error(
      `[FATAL] Could not sign in as ${TEST_USER_EMAIL}: ${(err as Error).message}`,
    )
    Deno.exit(1)
  }

  let passed = 0
  let failed = 0

  const tests: Array<[string, () => Promise<void>]> = [
    // ── Task 5.1 — Happy paths ──────────────────────────────────────────────
    [
      'T1: get_mi_perfil (9-key profile shape + email + estado + edad)',
      () => testGetMiPerfil(pac1),
    ],
    [
      'T2: get_mi_tratamiento_activo (7-key shape + nivelActual=1 + nivelesTotales=4)',
      () => testGetMiTratamientoActivo(pac1),
    ],
    [
      'T3: get_mi_plan_semanal (array of weekly plan objects)',
      () => testGetMiPlanSemanal(pac1),
    ],
    [
      'T4: get_mi_evaluacion_vigente (vigente=true + nivelId + 2 frases)',
      () => testGetMiEvaluacionVigente(pac1),
    ],
    [
      'T5: submit_mi_evaluacion(v_nivel_1_1, 3, 4) → {ok:true} + score=3.5',
      () => testSubmitMiEvaluacion(pac1, admin),
    ],
    [
      'T6: get_mi_estructura_actual happy path (3 mediciones, ordered valores)',
      () => testGetMiEstructuraActualHappyPath(pac1),
    ],
    [
      'T7: get_mi_estructura_actual BA boundary + cierre_automatico exclusion + empty',
      () => testGetMiEstructuraActualBoundaryYVacio(admin),
    ],
    // ── Task 5.2 — Error codes ──────────────────────────────────────────────
    [
      'E1: no_vinculado — terapeuta1 (no pacientes row) raises no_vinculado',
      () => testErrorNoVinculado(),
    ],
    [
      'E2: sin_etapa_activa — pac4 etapa closed → 4 gated RPCs + submit raise sin_etapa_activa',
      () => testErrorSinEtapaActiva(admin),
    ],
    [
      "E3: nivel_ajeno — pac1 submits on Martín's nivel_2_3 → nivel_ajeno",
      () => testErrorNivelAjeno(pac1),
    ],
    [
      'E4: score_invalido — causa=6 raises it; algoritmo=0 raises it',
      () => testErrorScoreInvalido(pac1, admin),
    ],
    [
      'E5: ya_respondida — second submit on same nivel raises ya_respondida',
      () => testErrorYaRespondida(pac1, admin),
    ],
    // ── Task 5.2 — Parity ───────────────────────────────────────────────────
    [
      'P1: parity — get_mi_tratamiento_activo === mapAsignacionToPaciente on pac1',
      () => testParidadTratamientoVsMapper(pac1, admin),
    ],
    // ── Task 5.3 — Security properties ─────────────────────────────────────
    [
      'S1: no IDOR — pac1 reads own data; p_paciente_id injection rejected',
      () => testPropNoIDOR(pac1),
    ],
    [
      'S2: 0 forbidden fields — no clinical/internal keys in read RPC output',
      () => testPropNoForbiddenKeys(pac1),
    ],
    [
      'S3: weekly lock — futura weeks have recursoRef=null and frases=[]',
      () => testPropWeeklyLock(pac1, admin),
    ],
  ]

  for (const [name, fn] of tests) {
    try {
      await fn()
      passed++
    } catch (err) {
      console.error(`\n[FAIL] ${name}: ${(err as Error).message}`)
      failed++
      // Best-effort cleanup so subsequent tests start clean.
      await fullCleanup(admin).catch(() => {})
    }
  }

  // Final cleanup: remove the nivel_evaluacion row created by T5.
  await fullCleanup(admin)

  console.log(
    '\n═══════════════════════════════════════════════════════════════',
  )
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log('═══════════════════════════════════════════════════════════════')

  if (failed > 0) {
    Deno.exit(1)
  }
}

await main()
