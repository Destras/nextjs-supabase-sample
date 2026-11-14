/**
 * auth.test.ts — Deno unit tests for checkPatientAuth
 *
 * Run with:
 *   deno test --allow-all --node-modules-dir=auto \
 *     supabase/functions/paciente-cuenta/lib/auth.test.ts
 *
 * No live DB: the user-client factory is injected so getUser() can be mocked.
 *
 * Covers:
 *   - Missing Authorization header → 401
 *   - Malformed token (no payload segment / not JSON) → 401
 *   - Payload without a usable `sub` → 401
 *   - base64url payload containing `-` / `_` decodes correctly (regression guard:
 *     the bare `atob` version in terapeuta-invitations/lib/auth.ts throws on those
 *     characters and 401s legitimate callers — that bug is not to be reintroduced)
 *   - getUser() error → 401 (the unsigned decode never authorizes on its own)
 *   - Happy path → { ok: true, userId: <sub> }
 */

import { assertEquals } from 'jsr:@std/assert'
import { checkPatientAuth } from './auth.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'aaaaaaaa-1111-2222-3333-444444444444'

/** Encodes an object as a base64url JWT payload segment (no padding). */
const b64url = (obj: unknown): string =>
  btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const tokenFor = (payload: unknown): string =>
  `header.${b64url(payload)}.signature`

const requestWith = (authHeader?: string): Request =>
  new Request('http://localhost/paciente-cuenta', {
    method: 'POST',
    headers: authHeader ? { Authorization: authHeader } : {},
  })

/** Injectable stand-in for the anon client used to verify the token. */
const userClientReturning = (error: unknown) => () => ({
  auth: { getUser: () => Promise.resolve({ error }) },
})

// ── Tests ─────────────────────────────────────────────────────────────────────

Deno.test('checkPatientAuth — missing Authorization header → 401', async () => {
  const result = await checkPatientAuth(
    requestWith(),
    userClientReturning(null),
  )
  assertEquals(result, { ok: false, status: 401, error: 'no_autorizado' })
})

Deno.test('checkPatientAuth — malformed token → 401', async () => {
  const result = await checkPatientAuth(
    requestWith('Bearer not-a-jwt'),
    userClientReturning(null),
  )
  assertEquals(result.ok, false)
})

Deno.test('checkPatientAuth — payload without sub → 401', async () => {
  const result = await checkPatientAuth(
    requestWith(`Bearer ${tokenFor({ role: 'authenticated' })}`),
    userClientReturning(null),
  )
  assertEquals(result, { ok: false, status: 401, error: 'no_autorizado' })
})

Deno.test('checkPatientAuth — empty-string sub → 401', async () => {
  const result = await checkPatientAuth(
    requestWith(`Bearer ${tokenFor({ sub: '' })}`),
    userClientReturning(null),
  )
  assertEquals(result, { ok: false, status: 401, error: 'no_autorizado' })
})

Deno.test(
  'checkPatientAuth — base64url payload with - and _ decodes (atob regression)',
  async () => {
    // A payload whose base64 encoding is guaranteed to contain both `+` and `/`,
    // which base64url renders as `-` and `_`. Bare atob() throws on these.
    const payload = { sub: USER_ID, note: 'ÿÿÿ>>>???~~~', extra: 'ûÿþ' }
    const encoded = b64url(payload)
    assertEquals(
      /[-_]/.test(encoded),
      true,
      'fixture is only meaningful if the payload actually encodes to - or _',
    )

    const result = await checkPatientAuth(
      requestWith(`Bearer ${encoded === '' ? '' : `header.${encoded}.sig`}`),
      userClientReturning(null),
    )
    assertEquals(result, { ok: true, userId: USER_ID })
  },
)

Deno.test(
  'checkPatientAuth — getUser() error → 401 (decode alone never authorizes)',
  async () => {
    const result = await checkPatientAuth(
      requestWith(`Bearer ${tokenFor({ sub: USER_ID })}`),
      userClientReturning({ message: 'invalid JWT' }),
    )
    assertEquals(result, { ok: false, status: 401, error: 'no_autorizado' })
  },
)

Deno.test(
  'checkPatientAuth — valid token → ok with the sub as userId',
  async () => {
    const result = await checkPatientAuth(
      requestWith(`Bearer ${tokenFor({ sub: USER_ID })}`),
      userClientReturning(null),
    )
    assertEquals(result, { ok: true, userId: USER_ID })
  },
)

Deno.test('checkPatientAuth — Bearer prefix is case-insensitive', async () => {
  const result = await checkPatientAuth(
    requestWith(`bearer ${tokenFor({ sub: USER_ID })}`),
    userClientReturning(null),
  )
  assertEquals(result, { ok: true, userId: USER_ID })
})
