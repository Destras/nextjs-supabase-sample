import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../lib/response.ts'

interface DeleteAccountOptions {
  /** Espera entre el primer intento de deleteUser y el reintento. Solo los tests lo bajan a 0. */
  retryDelayMs?: number
}

const DEFAULT_RETRY_DELAY_MS = 250

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve()

/**
 * Baja voluntaria de la cuenta del paciente que hace el request.
 *
 * Dos pasos, en este orden y sin excepción:
 *
 *   1. rpc baja_voluntaria_paciente(p_user_id) — una sola transacción que
 *      desvincula la ficha, la marca baja_voluntaria, cierra asignación y etapa,
 *      supersede el OTP vigente y audita.
 *   2. auth.admin.deleteUser(userId) — borra la credencial.
 *
 * INVERTIR EL ORDEN ROMPE: pacientes.user_id referencia auth.users(id) sin
 * "on delete", o sea NO ACTION, así que borrar la cuenta primero levanta 23503.
 * El test D8 lo fija.
 *
 * `userId` viene SIEMPRE de checkPatientAuth (el sub del JWT verificado), nunca
 * del body. Es la única obligación de esta capa y es lo que impide que un
 * paciente le cierre la cuenta a otro.
 *
 * Ventana de fallo (ADR-5): si la RPC commitea y deleteUser falla, se reintenta
 * una vez. Si vuelve a fallar se devuelve 500 baja_parcial y se deja el estado
 * degradado a propósito: la cuenta huérfana conserva su JWT hasta que expire y
 * el paciente puede reintentar, porque el endpoint es idempotente. NO se
 * compensa re-vinculando user_id — eso resucitaría una cuenta borrada, reabriría
 * la vía del OTP y contradiría la fila de auditoría ya commiteada. El test D9 lo
 * fija. El estado degradado es seguro: todas las RPCs de paciente levantan
 * no_vinculado con user_id en null, y pacientes nunca dio lectura al paciente.
 */
const handleDeleteAccount = async (
  supabaseAdmin: SupabaseClient,
  userId: string,
  options: DeleteAccountOptions = {},
): Promise<Response> => {
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS

  // ── Paso 1 ────────────────────────────────────────────────────────────────
  const { data, error: rpcError } = await supabaseAdmin.rpc(
    'baja_voluntaria_paciente',
    { p_user_id: userId },
  )

  if (rpcError) {
    // 42501 = el llamador es terapeuta o admin. Es un resultado de autorización,
    // no un error de infraestructura.
    if (rpcError.code === '42501') {
      console.error(
        JSON.stringify({
          action: 'delete-account',
          step: 'rpc',
          errorCode: rpcError.code,
          errorMessage: rpcError.message ?? null,
        }),
      )
      return jsonResponse(403, { error: 'no_autorizado' })
    }

    console.error(
      JSON.stringify({
        action: 'delete-account',
        step: 'rpc',
        errorCode: rpcError.code ?? null,
        errorMessage: rpcError.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'error_db' })
  }

  // 'ok' y 'ya_dado_de_baja' siguen los dos al paso 2. El segundo es la reentrada
  // tras un deleteUser fallido: hay que volver a intentar borrar la credencial.
  const pacienteId =
    (data as { pacienteId?: string | null } | null)?.pacienteId ?? null

  // ── Paso 2, con un reintento acotado ──────────────────────────────────────
  let lastError: { code?: string; message?: string } | null = null

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (!error) return jsonResponse(200, { ok: true })

    lastError = error
    if (attempt === 1) await sleep(retryDelayMs)
  }

  console.error(
    JSON.stringify({
      action: 'delete-account',
      pacienteId,
      step: 'deleteUser',
      errorCode: lastError?.code ?? null,
      errorMessage: lastError?.message ?? null,
    }),
  )
  return jsonResponse(500, { error: 'baja_parcial' })
}

export { handleDeleteAccount }
export type { DeleteAccountOptions }
