import { BASE_URL, getServiceRoleClient } from './supabase'

/**
 * Verifies the three prerequisites every E2E run depends on, each with its
 * own distinct, actionable error message:
 *
 * 1. `SUPABASE_SERVICE_ROLE_KEY` (and `NEXT_PUBLIC_SUPABASE_URL`) are set.
 * 2. The dev server responds on `BASE_URL`.
 * 3. A service-role `select` against a seed catalog table succeeds (proves
 *    local Supabase is up and the seed has been applied).
 *
 * Also warns (does not fail) if a previous run left `E2E-%` patients behind
 * — those are a sign of a crashed run's cleanup never firing, not a reason
 * to block this run.
 */
const assertPreflight = async (): Promise<void> => {
  // 1. Env vars present.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error(
      'Preflight failed: NEXT_PUBLIC_SUPABASE_URL is not set. Check .env.local.',
    )
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Preflight failed: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Copy it from `npx supabase status` into .env.local (never prefix it with NEXT_PUBLIC_).',
    )
  }

  // 2. Dev server responds.
  try {
    const response = await fetch(BASE_URL)
    if (!response.ok && response.status >= 500) {
      throw new Error(`status ${response.status}`)
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Preflight failed: dev server did not respond at ${BASE_URL} (${detail}). ` +
        'Run `npm run dev` before the E2E suite.',
    )
  }

  // 3. Service-role select against a seed catalog table.
  const supabase = getServiceRoleClient()
  const { error } = await supabase.from('causas').select('id').limit(1)
  if (error) {
    throw new Error(
      `Preflight failed: service-role select on 'causas' failed (${error.message}). ` +
        'Check that local Supabase is running and the seed has been applied (`npx supabase start` / `npx supabase db reset`).',
    )
  }

  // Non-blocking warning: leftover patients from a previous run whose cleanup
  // never fired (e.g. a crashed worker).
  const { data: leftovers, error: leftoverError } = await supabase
    .from('pacientes')
    .select('id, nombre')
    .like('nombre', 'E2E-%')

  if (!leftoverError && leftovers && leftovers.length > 0) {
    console.warn(
      `Preflight warning: ${leftovers.length} leftover E2E patient(s) from a previous run were found ` +
        `(e.g. "${leftovers[0].nombre}"). They will not block this run, but consider investigating why their cleanup did not fire.`,
    )
  }
}

export { assertPreflight }
