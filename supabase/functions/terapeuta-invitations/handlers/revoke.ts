import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../lib/response.ts'

const handleRevoke = async (
  supabaseAdmin: SupabaseClient,
  body: unknown,
): Promise<Response> => {
  const terapeutaId = (body as Record<string, unknown>).terapeutaId
  if (typeof terapeutaId !== 'string')
    return jsonResponse(400, { error: 'body_invalido' })

  // Validar estado = pendiente
  const { data: terapeuta } = await supabaseAdmin
    .from('terapeutas')
    .select('estado_id, estados_terapeuta(codigo)')
    .eq('id', terapeutaId)
    .single()

  if (
    !terapeuta ||
    (terapeuta.estados_terapeuta as { codigo: string } | null)?.codigo !==
      'pendiente'
  ) {
    return jsonResponse(400, { error: 'estado_invalido' })
  }

  // Cascade: borrar auth user → on delete cascade limpia profiles + terapeutas
  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(terapeutaId)
  if (deleteError) {
    console.error(
      JSON.stringify({
        action: 'revoke',
        step: 'deleteUser',
        terapeutaId,
        errorCode: deleteError.code ?? null,
        errorMessage: deleteError.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'delete_failed' })
  }

  return jsonResponse(200, { ok: true })
}

export { handleRevoke }
