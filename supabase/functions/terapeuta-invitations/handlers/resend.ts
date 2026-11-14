import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse } from '../lib/response.ts'

const handleResend = async (
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

  // Obtener email del auth user
  const { data: authUser } =
    await supabaseAdmin.auth.admin.getUserById(terapeutaId)
  if (!authUser?.user?.email) {
    console.error(
      JSON.stringify({
        action: 'resend',
        step: 'getUserById',
        terapeutaId,
        errorMessage: 'email_no_disponible',
      }),
    )
    return jsonResponse(500, { error: 'email_no_disponible' })
  }

  // Reenviar invite (Supabase regenera link + manda email)
  const { error: inviteError } =
    await supabaseAdmin.auth.admin.inviteUserByEmail(authUser.user.email, {
      redirectTo: `${Deno.env.get('WEB_CONSOLE_URL')}/auth/update-password`,
    })
  if (inviteError) {
    console.error(
      JSON.stringify({
        action: 'resend',
        step: 'inviteUserByEmail',
        terapeutaId,
        errorCode: inviteError.code ?? null,
        errorMessage: inviteError.message ?? null,
      }),
    )
    return jsonResponse(500, { error: 'resend_failed' })
  }

  return jsonResponse(200, { ok: true })
}

export { handleResend }
