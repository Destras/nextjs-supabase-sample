/**
 * dispatcher.test.ts — Deno unit tests for the paciente-cuenta dispatcher
 *
 * Run with:
 *   deno test --allow-all --node-modules-dir=auto \
 *     supabase/functions/paciente-cuenta/dispatcher.test.ts
 *
 * `handleRequest` vive en dispatcher.ts y no en index.ts a propósito: index.ts
 * llama Deno.serve a nivel de módulo, así que importarlo desde un test levantaría
 * un servidor. index.ts queda como wiring de una línea.
 *
 * Auth y el cliente admin se inyectan, así que nada toca la red.
 *
 * Covers:
 *   - non-POST → 405 method_not_allowed
 *   - no / invalid JWT → 401 no_autorizado, and NO handler work is done
 *   - unparseable body → 400 body_invalido
 *   - missing / non-string / unknown action → 400 body_invalido
 *   - action 'delete-account' → dispatched with the userId from the token
 *   - the userId passed to the handler comes from auth, never from the body
 */

import { assertEquals } from 'jsr:@std/assert'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { handleRequest } from './dispatcher.ts'
import type { RequestDeps } from './dispatcher.ts'

const USER_ID = 'aaaaaaaa-1111-2222-3333-444444444444'
const OTHER_USER_ID = 'bbbbbbbb-9999-9999-9999-999999999999'

interface Spy {
  deps: RequestDeps
  handlerCalls: Array<{ userId: string }>
}

const makeDeps = (
  authResult:
    | { ok: true; userId: string }
    | { ok: false; status: 401; error: string } = {
    ok: true,
    userId: USER_ID,
  },
): Spy => {
  const handlerCalls: Array<{ userId: string }> = []
  return {
    handlerCalls,
    deps: {
      checkPatientAuth: () => Promise.resolve(authResult),
      createSupabaseAdminClient: () => ({}) as unknown as SupabaseClient,
      handleDeleteAccount: (_client: SupabaseClient, userId: string) => {
        handlerCalls.push({ userId })
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      },
    },
  }
}

const post = (body: unknown, raw?: string): Request =>
  new Request('http://localhost/paciente-cuenta', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer token',
      'Content-Type': 'application/json',
    },
    body: raw !== undefined ? raw : JSON.stringify(body),
  })

// ── Method ────────────────────────────────────────────────────────────────────

Deno.test('dispatcher — non-POST → 405 method_not_allowed', async () => {
  const { deps, handlerCalls } = makeDeps()
  const res = await handleRequest(
    new Request('http://localhost/paciente-cuenta', { method: 'GET' }),
    deps,
  )

  assertEquals(res.status, 405)
  assertEquals(await res.json(), { error: 'method_not_allowed' })
  assertEquals(handlerCalls.length, 0)
})

// ── Auth ──────────────────────────────────────────────────────────────────────

Deno.test('dispatcher — invalid JWT → 401 and no handler work', async () => {
  const { deps, handlerCalls } = makeDeps({
    ok: false,
    status: 401,
    error: 'no_autorizado',
  })
  const res = await handleRequest(post({ action: 'delete-account' }), deps)

  assertEquals(res.status, 401)
  assertEquals(await res.json(), { error: 'no_autorizado' })
  assertEquals(
    handlerCalls.length,
    0,
    'nothing runs for an unauthenticated caller',
  )
})

// ── Body ──────────────────────────────────────────────────────────────────────

Deno.test('dispatcher — unparseable body → 400 body_invalido', async () => {
  const { deps, handlerCalls } = makeDeps()
  const res = await handleRequest(post(null, '{not json'), deps)

  assertEquals(res.status, 400)
  assertEquals(await res.json(), { error: 'body_invalido' })
  assertEquals(handlerCalls.length, 0)
})

Deno.test('dispatcher — missing action → 400 body_invalido', async () => {
  const { deps, handlerCalls } = makeDeps()
  const res = await handleRequest(post({}), deps)

  assertEquals(res.status, 400)
  assertEquals(await res.json(), { error: 'body_invalido' })
  assertEquals(handlerCalls.length, 0)
})

Deno.test('dispatcher — non-string action → 400 body_invalido', async () => {
  const { deps } = makeDeps()
  const res = await handleRequest(post({ action: 42 }), deps)

  assertEquals(res.status, 400)
  assertEquals(await res.json(), { error: 'body_invalido' })
})

Deno.test('dispatcher — unknown action → 400 body_invalido', async () => {
  const { deps, handlerCalls } = makeDeps()
  const res = await handleRequest(post({ action: 'drop-everything' }), deps)

  assertEquals(res.status, 400)
  assertEquals(await res.json(), { error: 'body_invalido' })
  assertEquals(handlerCalls.length, 0)
})

// ── Dispatch ──────────────────────────────────────────────────────────────────

Deno.test(
  "dispatcher — action 'delete-account' → dispatched, 200",
  async () => {
    const { deps, handlerCalls } = makeDeps()
    const res = await handleRequest(post({ action: 'delete-account' }), deps)

    assertEquals(res.status, 200)
    assertEquals(await res.json(), { ok: true })
    assertEquals(handlerCalls, [{ userId: USER_ID }])
  },
)

Deno.test(
  'dispatcher — userId comes from the token, never from the body',
  async () => {
    // The whole IDOR control at this layer: a caller who puts someone else's id in
    // the body must still only be able to delete their own account.
    const { deps, handlerCalls } = makeDeps()
    await handleRequest(
      post({
        action: 'delete-account',
        userId: OTHER_USER_ID,
        p_user_id: OTHER_USER_ID,
      }),
      deps,
    )

    assertEquals(handlerCalls, [{ userId: USER_ID }])
  },
)
