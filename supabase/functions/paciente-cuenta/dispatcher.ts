import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { handleDeleteAccount } from './handlers/deleteAccount.ts'
import { checkPatientAuth } from './lib/auth.ts'
import type { PatientAuthResult } from './lib/auth.ts'
import { createSupabaseAdminClient } from './lib/clients.ts'
import { jsonResponse } from './lib/response.ts'

/**
 * Dependencias inyectables. En producción se usan los defaults; los tests las
 * reemplazan para no tocar la red.
 */
interface RequestDeps {
  checkPatientAuth: (req: Request) => Promise<PatientAuthResult>
  createSupabaseAdminClient: () => SupabaseClient
  handleDeleteAccount: (
    supabaseAdmin: SupabaseClient,
    userId: string,
  ) => Promise<Response>
}

const defaultDeps: RequestDeps = {
  checkPatientAuth: (req) => checkPatientAuth(req),
  createSupabaseAdminClient,
  handleDeleteAccount: (client, userId) => handleDeleteAccount(client, userId),
}

/**
 * Dispatcher de paciente-cuenta.
 *
 * Recurso "cuenta del paciente", con acciones. Hoy hay una sola
 * (`delete-account`), pero el discriminador no es gratuito por casualidad:
 * supabase.functions.invoke siempre POSTea un body y no sabe expresar un
 * `DELETE /account`, así que el body va por la red igual. Y en un endpoint
 * destructivo el `action` es un token de intención deliberada: un POST vacío o
 * malformado NO borra una cuenta, hay que nombrar la operación.
 *
 * Orden de los checks: método → auth → body. Auth antes que el body a propósito:
 * no se hace ningún trabajo, ni se revela nada sobre el formato esperado, a un
 * llamador que no probó quién es.
 *
 * El userId sale SIEMPRE de checkPatientAuth, nunca del body. Es el control
 * anti-IDOR de esta capa y tiene su propio test.
 */
const handleRequest = async (
  req: Request,
  deps: RequestDeps = defaultDeps,
): Promise<Response> => {
  const startMs = Date.now()

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed' })
  }

  const auth = await deps.checkPatientAuth(req)
  if (!auth.ok) {
    return jsonResponse(auth.status, { error: auth.error })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof (body as Record<string, unknown>).action !== 'string') {
    return jsonResponse(400, { error: 'body_invalido' })
  }

  const action = (body as Record<string, unknown>).action as string
  let response: Response

  switch (action) {
    case 'delete-account': {
      const supabaseAdmin = deps.createSupabaseAdminClient()
      response = await deps.handleDeleteAccount(supabaseAdmin, auth.userId)
      break
    }
    default:
      response = jsonResponse(400, { error: 'body_invalido' })
  }

  // Nunca loguear el JWT ni ningún token. userId sí: es el sujeto de la operación
  // y sin él la línea de log no sirve para investigar nada.
  console.log(
    JSON.stringify({
      action,
      userId: auth.userId,
      status: response.status,
      latencyMs: Date.now() - startMs,
    }),
  )

  return response
}

export { handleRequest }
export type { RequestDeps }
