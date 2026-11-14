import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../lib/response.ts'

const handleDeactivate = async (
  supabaseAdmin: SupabaseClient,
  body: unknown,
  callerId: string,
): Promise<Response> => {
  const terapeutaId = (body as Record<string, unknown>).terapeutaId
  const motivo = (body as Record<string, unknown>).motivo

  if (typeof terapeutaId !== 'string') {
    return jsonResponse(400, { error: 'body_invalido' })
  }
  if (typeof motivo !== 'string' || !motivo.trim()) {
    return jsonResponse(400, { error: 'motivo_requerido' })
  }

  // Guard: the Edge Function validates self-deactivation before invoking the
  // RPC (which runs under service-role and cannot rely on auth.uid()).
  if (callerId === terapeutaId) {
    return jsonResponse(400, { error: 'no_puede_autodesactivarse' })
  }

  // Invoke RPC with explicit caller id for audit_log.
  const { data, error } = await supabaseAdmin.rpc('deactivate_terapeuta', {
    p_terapeuta_id: terapeutaId,
    p_motivo: motivo.trim(),
    p_caller_id: callerId,
  })

  if (error) {
    if (error.code === 'P0002') {
      let count: number | undefined
      try {
        const detail = JSON.parse(error.details || '{}')
        count = detail.count
      } catch {
        // detail not parseable — omit count
      }
      return jsonResponse(400, { error: 'tiene_pacientes_activos', count })
    }
    if (error.message?.includes('motivo_requerido')) {
      return jsonResponse(400, { error: 'motivo_requerido' })
    }
    console.error(
      JSON.stringify({
        action: 'deactivate',
        step: 'rpc_deactivate_terapeuta',
        terapeutaId,
        errorCode: error.code ?? null,
        errorMessage: error.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'deactivate_failed' })
  }

  // Ban the auth user (~100 years) per DEC-4.
  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
    terapeutaId,
    { ban_duration: '876000h' },
  )
  if (banError) {
    // Pathological case: RPC succeeded but ban failed. Log and surface error —
    // no automatic rollback (DB state is already inactivo).
    console.error(
      JSON.stringify({
        action: 'deactivate',
        step: 'ban_after_rpc',
        terapeutaId,
        errorCode: banError.code ?? null,
        errorMessage: banError.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'ban_failed_after_db_change' })
  }

  return jsonResponse(200, { ok: true, terapeuta: data?.[0] ?? null })
}

export { handleDeactivate }
