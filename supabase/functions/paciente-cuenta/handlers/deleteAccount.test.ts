/**
 * deleteAccount.test.ts — Deno unit tests for handleDeleteAccount
 *
 * Run with:
 *   deno test --allow-all --node-modules-dir=auto \
 *     supabase/functions/paciente-cuenta/handlers/deleteAccount.test.ts
 *
 * All Supabase client calls are mocked — no live DB.
 *
 * Covers:
 *   - RPC ok + deleteUser ok → 200 { ok: true }
 *   - RPC ya_dado_de_baja + deleteUser ok → 200 (the retry / recovery path)
 *   - RPC error 42501 → 403 no_autorizado
 *   - RPC error other → 500 error_db
 *   - deleteUser fails once then succeeds → 200 (the bounded retry works)
 *   - deleteUser fails twice → 500 baja_parcial
 *   - D8: rpc is invoked strictly BEFORE auth.admin.deleteUser
 *   - D9: on deleteUser failure the handler makes NO further rpc call
 *         (it must never re-link pacientes.user_id — the system is forward-only)
 */

import { assertEquals } from 'jsr:@std/assert'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { handleDeleteAccount } from './deleteAccount.ts'

const USER_ID = 'aaaaaaaa-1111-2222-3333-444444444444'
const PACIENTE_ID = 'd0000005-0000-0000-0000-000000000000'

interface MockOpts {
  rpcData?: { status: string; pacienteId: string | null } | null
  rpcError?: { code?: string; message?: string } | null
  /** One entry per deleteUser attempt, consumed in order. */
  deleteUserErrors?: Array<{ code?: string; message?: string } | null>
}

interface MockResult {
  client: SupabaseClient
  calls: string[]
  rpcArgs: Array<Record<string, unknown>>
}

const makeMock = (opts: MockOpts): MockResult => {
  const calls: string[] = []
  const rpcArgs: Array<Record<string, unknown>> = []
  const deleteErrors = [...(opts.deleteUserErrors ?? [null])]

  const client = {
    rpc: (_fn: string, args: Record<string, unknown>) => {
      calls.push('rpc')
      rpcArgs.push(args)
      return Promise.resolve({
        data: opts.rpcData ?? null,
        error: opts.rpcError ?? null,
      })
    },
    auth: {
      admin: {
        deleteUser: () => {
          calls.push('deleteUser')
          const error = deleteErrors.length > 0 ? deleteErrors.shift()! : null
          return Promise.resolve({ data: null, error })
        },
      },
    },
  } as unknown as SupabaseClient

  return { client, calls, rpcArgs }
}

/** Zero delay so the bounded retry does not slow the suite down. */
const NO_WAIT = { retryDelayMs: 0 }

// ── Happy path ────────────────────────────────────────────────────────────────

Deno.test(
  'handleDeleteAccount — RPC ok + deleteUser ok → 200 { ok: true }',
  async () => {
    const { client } = makeMock({
      rpcData: { status: 'ok', pacienteId: PACIENTE_ID },
    })
    const res = await handleDeleteAccount(client, USER_ID, NO_WAIT)

    assertEquals(res.status, 200)
    assertEquals(await res.json(), { ok: true })
  },
)

Deno.test(
  'handleDeleteAccount — passes the verified userId as p_user_id',
  async () => {
    const { client, rpcArgs } = makeMock({
      rpcData: { status: 'ok', pacienteId: PACIENTE_ID },
    })
    await handleDeleteAccount(client, USER_ID, NO_WAIT)

    assertEquals(rpcArgs[0], { p_user_id: USER_ID })
  },
)

Deno.test(
  'handleDeleteAccount — RPC ya_dado_de_baja + deleteUser ok → 200 (retry path)',
  async () => {
    // This is the recovery path: the RPC already committed on an earlier attempt
    // and deleteUser failed. Re-entering must succeed, not error.
    const { client } = makeMock({
      rpcData: { status: 'ya_dado_de_baja', pacienteId: null },
    })
    const res = await handleDeleteAccount(client, USER_ID, NO_WAIT)

    assertEquals(res.status, 200)
    assertEquals(await res.json(), { ok: true })
  },
)

// ── RPC failures ──────────────────────────────────────────────────────────────

Deno.test('handleDeleteAccount — RPC 42501 → 403 no_autorizado', async () => {
  const { client, calls } = makeMock({
    rpcError: { code: '42501', message: 'no_autorizado' },
  })
  const res = await handleDeleteAccount(client, USER_ID, NO_WAIT)

  assertEquals(res.status, 403)
  assertEquals(await res.json(), { error: 'no_autorizado' })
  assertEquals(
    calls.includes('deleteUser'),
    false,
    'must not delete the auth user',
  )
})

Deno.test('handleDeleteAccount — other RPC error → 500 error_db', async () => {
  const { client, calls } = makeMock({
    rpcError: {
      code: 'P0002',
      message: 'estado_baja_voluntaria_no_encontrado',
    },
  })
  const res = await handleDeleteAccount(client, USER_ID, NO_WAIT)

  assertEquals(res.status, 500)
  assertEquals(await res.json(), { error: 'error_db' })
  assertEquals(
    calls.includes('deleteUser'),
    false,
    'must not delete the auth user',
  )
})

// ── deleteUser failures ───────────────────────────────────────────────────────

Deno.test(
  'handleDeleteAccount — deleteUser fails once then succeeds → 200',
  async () => {
    const { client, calls } = makeMock({
      rpcData: { status: 'ok', pacienteId: PACIENTE_ID },
      deleteUserErrors: [{ message: 'transient' }, null],
    })
    const res = await handleDeleteAccount(client, USER_ID, NO_WAIT)

    assertEquals(res.status, 200)
    assertEquals(await res.json(), { ok: true })
    assertEquals(calls.filter((c) => c === 'deleteUser').length, 2)
  },
)

Deno.test(
  'handleDeleteAccount — deleteUser fails twice → 500 baja_parcial',
  async () => {
    const { client, calls } = makeMock({
      rpcData: { status: 'ok', pacienteId: PACIENTE_ID },
      deleteUserErrors: [{ message: 'down' }, { message: 'still down' }],
    })
    const res = await handleDeleteAccount(client, USER_ID, NO_WAIT)

    assertEquals(res.status, 500)
    assertEquals(await res.json(), { error: 'baja_parcial' })
    assertEquals(
      calls.filter((c) => c === 'deleteUser').length,
      2,
      'bounded at 2 attempts',
    )
  },
)

// ── Ordering and compensation invariants ──────────────────────────────────────

Deno.test(
  'handleDeleteAccount — D8: rpc runs strictly before deleteUser',
  async () => {
    // pacientes.user_id references auth.users(id) with NO ACTION. Deleting the auth
    // user first raises 23503. Layer A proves WHY the order matters; this proves the
    // handler honours it.
    const { client, calls } = makeMock({
      rpcData: { status: 'ok', pacienteId: PACIENTE_ID },
    })
    await handleDeleteAccount(client, USER_ID, NO_WAIT)

    assertEquals(calls, ['rpc', 'deleteUser'])
  },
)

Deno.test(
  'handleDeleteAccount — D9: no compensating rpc after deleteUser fails',
  async () => {
    // Re-linking pacientes.user_id would resurrect a deleted account, re-open the
    // OTP path and contradict the audit row already committed. Forward-only.
    const { client, calls } = makeMock({
      rpcData: { status: 'ok', pacienteId: PACIENTE_ID },
      deleteUserErrors: [{ message: 'down' }, { message: 'still down' }],
    })
    await handleDeleteAccount(client, USER_ID, NO_WAIT)

    assertEquals(
      calls.filter((c) => c === 'rpc').length,
      1,
      'exactly one rpc call, ever',
    )
  },
)
