import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Sole reader of `SUPABASE_SERVICE_ROLE_KEY` in the E2E harness.
 *
 * Every privileged util (cleanup, clock, patient simulator, preflight)
 * imports its client from here instead of reading the env var directly.
 * This keeps the service-role blast radius auditable at a single choke
 * point and guarantees the key is never read from `e2e/` code that could
 * end up imported by app/client code — `e2e/` is not imported by any app
 * module, and this module deliberately does not use the `NEXT_PUBLIC_`
 * prefix so Next's bundler can never inline it client-side.
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

let cachedClient: SupabaseClient | undefined

const getServiceRoleClient = (): SupabaseClient => {
  if (cachedClient) return cachedClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error(
      'e2e/utils/supabase.ts: NEXT_PUBLIC_SUPABASE_URL is not set. Check .env.local.',
    )
  }
  if (!serviceRoleKey) {
    throw new Error(
      'e2e/utils/supabase.ts: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Copy it from `npx supabase status` into .env.local (never prefix it with NEXT_PUBLIC_).',
    )
  }

  cachedClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedClient
}

export { BASE_URL, getServiceRoleClient }
