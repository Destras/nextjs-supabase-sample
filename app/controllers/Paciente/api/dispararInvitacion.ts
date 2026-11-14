'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * `enviadas` es la cuenta de mensajes que la Edge Function efectivamente mandó,
 * tal como la devuelve su body (`{ ok, enviadas }`):
 *
 *   1 → salió la bienvenida.
 *   0 → no hacía falta mandarla: el paciente ya tiene cuenta, está en baja
 *       voluntaria, o ya la recibió antes (`bienvenida_entregada_at`). NO es un
 *       error, y es el caso normal al volver a guardar un plan ya completo.
 *   null → no se pudo saber: la invocación falló, o el body no trajo el campo.
 *
 * Distinguir 1 de 0 es lo único que deja avisarle al terapeuta si salió un
 * WhatsApp sin mentirle cuando no salió ninguno. Lo que NO se puede saber acá es
 * si el mensaje LLEGÓ al teléfono: `enviadas: 1` significa "Meta aceptó el POST".
 * Para la entrega real hace falta el webhook de estados de Meta, que todavía no
 * existe (ver los pendientes de activacionPorTelefono).
 */
interface DispararInvitacionResult {
  readonly ok: boolean
  readonly enviadas: number | null
  readonly error: string | null
}

const leerEnviadas = (data: unknown): number | null => {
  const enviadas = (data as { enviadas?: unknown } | null)?.enviadas
  return typeof enviadas === 'number' ? enviadas : null
}

const dispararInvitacion = async (
  pacienteId: string,
): Promise<DispararInvitacionResult> => {
  try {
    const supabase = createClient()
    const { data, error: invokeError } = await supabase.functions.invoke(
      'paciente-invitacion',
      { body: { pacienteId } },
    )
    if (invokeError) {
      return { ok: false, enviadas: null, error: invokeError.message }
    }
    return { ok: true, enviadas: leerEnviadas(data), error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invoke_error'
    return { ok: false, enviadas: null, error: message }
  }
}

export type { DispararInvitacionResult }
export { dispararInvitacion }
