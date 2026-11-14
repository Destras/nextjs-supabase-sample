import { test } from '@playwright/test'
import { getServiceRoleClient } from './supabase'

interface CleanupReport {
  readonly [table: string]: number
}

interface CleanupTracker {
  track(token: string): string
  purge(): Promise<CleanupReport>
}

/**
 * Deletes every row tagged with `token` in child-before-parent order,
 * mirroring `.docs/manualtesting/uat-teardown.sql` and extended at both
 * ends (the patient subtree has not grown a new table since that file was
 * written). Because none of these tables has a client-facing DELETE RLS
 * policy, this MUST run against the service-role client — a client-key
 * delete would return HTTP success with 0 rows affected and silently do
 * nothing.
 *
 * Verifies every deletion by re-querying (never trusts the delete
 * response alone), and finishes by deleting the `auth.users` row for any
 * patient this run linked to an account — `pacientes.user_id` has no
 * cascade, so that account would otherwise leak forever.
 */
const purgeToken = async (token: string): Promise<CleanupReport> => {
  const supabase = getServiceRoleClient()
  const report: Record<string, number> = {}

  const deleteAndVerify = async (
    table: string,
    column: string,
    ids: ReadonlyArray<string>,
  ): Promise<void> => {
    if (ids.length === 0) {
      report[table] = 0
      return
    }

    const { data, error } = await supabase
      .from(table)
      .delete()
      .in(column, ids)
      .select('*')

    if (error) {
      throw new Error(
        `cleanup: delete on '${table}' failed for token ${token}: ${error.message}`,
      )
    }

    report[table] = data?.length ?? 0

    const { data: remaining, error: verifyError } = await supabase
      .from(table)
      .select('*')
      .in(column, ids)

    if (verifyError) {
      throw new Error(
        `cleanup: verification select on '${table}' failed for token ${token}: ${verifyError.message}`,
      )
    }

    if (remaining && remaining.length > 0) {
      throw new Error(
        `cleanup: silent no-op detected — ${remaining.length} row(s) still present in '${table}' after delete for token ${token}.`,
      )
    }
  }

  const { data: pacientes, error: pacientesError } = await supabase
    .from('pacientes')
    .select('id, user_id')
    .like('nombre', `${token} %`)

  if (pacientesError) {
    throw new Error(
      `cleanup: could not resolve pacientes for token ${token}: ${pacientesError.message}`,
    )
  }

  const pacienteIds = (pacientes ?? []).map((p) => p.id as string)
  const userIds = (pacientes ?? [])
    .map((p) => p.user_id as string | null)
    .filter((id): id is string => id !== null)

  if (pacienteIds.length === 0) {
    return {
      nivel_evaluacion: 0,
      niveles: 0,
      entregas_plan: 0,
      etapa_alfabetos: 0,
      etapa_bloqueos: 0,
      etapas_tratamiento: 0,
      asignaciones_paciente: 0,
      alertas_atendidas: 0,
      pacientes: 0,
      auth_users: 0,
    }
  }

  const { data: etapas, error: etapasError } = await supabase
    .from('etapas_tratamiento')
    .select('id')
    .in('paciente_id', pacienteIds)

  if (etapasError) {
    throw new Error(
      `cleanup: could not resolve etapas_tratamiento for token ${token}: ${etapasError.message}`,
    )
  }
  const etapaIds = (etapas ?? []).map((e) => e.id as string)

  let nivelIds: string[] = []
  if (etapaIds.length > 0) {
    const { data: niveles, error: nivelesError } = await supabase
      .from('niveles')
      .select('id')
      .in('etapa_id', etapaIds)

    if (nivelesError) {
      throw new Error(
        `cleanup: could not resolve niveles for token ${token}: ${nivelesError.message}`,
      )
    }
    nivelIds = (niveles ?? []).map((n) => n.id as string)
  }

  // Level 4: evaluations hang off niveles.
  await deleteAndVerify('nivel_evaluacion', 'nivel_id', nivelIds)

  // Level 3: everything hanging off etapas_tratamiento.
  await deleteAndVerify('niveles', 'etapa_id', etapaIds)
  await deleteAndVerify('entregas_plan', 'etapa_id', etapaIds)
  await deleteAndVerify('etapa_alfabetos', 'etapa_id', etapaIds)
  await deleteAndVerify('etapa_bloqueos', 'etapa_id', etapaIds)

  // Level 2: direct children of pacientes.
  await deleteAndVerify('etapas_tratamiento', 'paciente_id', pacienteIds)
  await deleteAndVerify('asignaciones_paciente', 'paciente_id', pacienteIds)
  await deleteAndVerify('alertas_atendidas', 'paciente_id', pacienteIds)

  // Level 1: the patients themselves.
  await deleteAndVerify('pacientes', 'id', pacienteIds)

  // Level 0: auth.users accounts created by the patient simulator. No
  // cascade exists from pacientes.user_id, so this must run last and
  // explicitly, using the ids captured before the pacientes row was deleted.
  let deletedUsers = 0
  for (const userId of userIds) {
    const { error: deleteUserError } =
      await supabase.auth.admin.deleteUser(userId)
    if (deleteUserError) {
      throw new Error(
        `cleanup: auth.admin.deleteUser failed for user ${userId} (token ${token}): ${deleteUserError.message}`,
      )
    }
    deletedUsers += 1
  }
  report.auth_users = deletedUsers

  return report
}

/**
 * Re-queries `pacientes` for the token's pattern and throws if any row is
 * still present — the explicit "did cleanup actually work" check a spec
 * runs after `purge()`.
 */
const assertTokenPurged = async (token: string): Promise<void> => {
  const supabase = getServiceRoleClient()
  const { data, error } = await supabase
    .from('pacientes')
    .select('id')
    .like('nombre', `${token} %`)

  if (error) {
    throw new Error(
      `assertTokenPurged: query failed for token ${token}: ${error.message}`,
    )
  }

  if (data && data.length > 0) {
    throw new Error(
      `assertTokenPurged: ${data.length} pacientes row(s) still present for token ${token} after purge.`,
    )
  }
}

/**
 * Registers a `test.afterEach` hook that purges every token tracked during
 * the test. Plain functions, not a Playwright fixture (explicit user
 * decision) — a spec calls `registerCleanup()` once and then
 * `cleanup.track(token)` for each token it creates.
 */
const registerCleanup = (): CleanupTracker => {
  const tokens: string[] = []

  const tracker: CleanupTracker = {
    track(token: string): string {
      tokens.push(token)
      return token
    },
    async purge(): Promise<CleanupReport> {
      const reports = await Promise.all(tokens.map(purgeToken))
      const combined: Record<string, number> = {}
      for (const report of reports) {
        for (const [table, count] of Object.entries(report)) {
          combined[table] = (combined[table] ?? 0) + count
        }
      }
      return combined
    },
  }

  test.afterEach(async () => {
    await tracker.purge()
  })

  return tracker
}

export type { CleanupReport, CleanupTracker }
export { registerCleanup, purgeToken, assertTokenPurged }
