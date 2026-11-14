import { handleDeactivate } from './handlers/deactivate.ts'
import { handleInvite } from './handlers/invite.ts'
import { handleReactivate } from './handlers/reactivate.ts'
import { handleResend } from './handlers/resend.ts'
import { handleRevoke } from './handlers/revoke.ts'
import { checkAdmin } from './lib/auth.ts'
import { createSupabaseAdminClient } from './lib/clients.ts'
import { jsonResponse } from './lib/response.ts'
import { withCors } from '../_shared/cors.ts'

/**
 * terapeuta-invitations Edge Function
 *
 * Admin-only endpoint — guarded by checkAdmin (is_admin RPC over the caller JWT).
 *
 * Logging policy (mirrors patient-activation / DevSpec §10.5):
 *   - Log: action, terapeutaId (when present), callerId, status code, latency (ms)
 *   - NEVER log: email, nombre, JWT, or any credential / PII
 *   Handlers add a console.error with errorCode/errorMessage on every 5xx path.
 */
// withCors: contesta el preflight del navegador y convierte cualquier
// excepción en un 500 CON cabeceras CORS — si no, el navegador muestra un
// error de CORS en vez del error real. Ver _shared/cors.ts.
Deno.serve(
  withCors(async (req) => {
    const startMs = Date.now()

    if (req.method !== 'POST') {
      console.log(
        JSON.stringify({
          action: null,
          status: 405,
          latencyMs: Date.now() - startMs,
        }),
      )
      return jsonResponse(405, { error: 'method_not_allowed' })
    }

    // Per DEC-16: admin check vía RPC is_admin con el JWT del invocador.
    // checkAdmin now also returns the callerId (JWT sub) so handlers that invoke
    // RPCs under service-role can pass it explicitly for audit_log.
    const adminCheck = await checkAdmin(req)
    if (!adminCheck.ok) {
      console.warn(
        JSON.stringify({
          action: null,
          status: adminCheck.status,
          latencyMs: Date.now() - startMs,
          error: adminCheck.error,
        }),
      )
      return jsonResponse(adminCheck.status, { error: adminCheck.error })
    }

    const { callerId } = adminCheck

    const body = await req.json().catch(() => null)
    if (!body || typeof body.action !== 'string') {
      console.log(
        JSON.stringify({
          action: null,
          callerId,
          status: 400,
          latencyMs: Date.now() - startMs,
        }),
      )
      return jsonResponse(400, { error: 'body_invalido' })
    }

    const action: string = body.action
    const supabaseAdmin = createSupabaseAdminClient()

    let response: Response

    switch (action) {
      case 'invite':
        response = await handleInvite(supabaseAdmin, body)
        break
      case 'resend':
        response = await handleResend(supabaseAdmin, body)
        break
      case 'revoke':
        response = await handleRevoke(supabaseAdmin, body)
        break
      case 'deactivate':
        response = await handleDeactivate(supabaseAdmin, body, callerId)
        break
      case 'reactivate':
        response = await handleReactivate(supabaseAdmin, body, callerId)
        break
      default:
        response = jsonResponse(400, { error: 'action_invalida' })
    }

    // terapeutaId is a plain UUID string on the body for every action except
    // invite (which has none yet). Never log nombre/email (PII).
    const terapeutaId: string | null =
      typeof (body as Record<string, unknown>).terapeutaId === 'string'
        ? ((body as Record<string, unknown>).terapeutaId as string)
        : null

    console.log(
      JSON.stringify({
        action,
        terapeutaId,
        callerId,
        status: response.status,
        latencyMs: Date.now() - startMs,
      }),
    )

    return response
  }),
)
