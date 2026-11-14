import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../lib/response.ts'

const handleReactivate = async (
  supabaseAdmin: SupabaseClient,
  body: unknown,
  callerId: string,
): Promise<Response> => {
  const terapeutaId = (body as Record<string, unknown>).terapeutaId

  if (typeof terapeutaId !== 'string') {
    return jsonResponse(400, { error: 'body_invalido' })
  }

  // Invoke RPC with explicit caller id for audit_log.
  const { data, error } = await supabaseAdmin.rpc('reactivate_terapeuta', {
    p_terapeuta_id: terapeutaId,
    p_caller_id: callerId,
  })

  if (error) {
    console.error(
      JSON.stringify({
        action: 'reactivate',
        step: 'rpc_reactivate_terapeuta',
        terapeutaId,
        errorCode: error.code ?? null,
        errorMessage: error.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'reactivate_failed' })
  }

  // Lift the auth ban on the user.
  const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(
    terapeutaId,
    { ban_duration: 'none' },
  )
  if (unbanError) {
    // Pathological case: RPC succeeded but unban failed.
    console.error(
      JSON.stringify({
        action: 'reactivate',
        step: 'unban_after_rpc',
        terapeutaId,
        errorCode: unbanError.code ?? null,
        errorMessage: unbanError.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'unban_failed_after_db_change' })
  }

  return jsonResponse(200, { ok: true, terapeuta: data?.[0] ?? null })
}

export { handleReactivate }
