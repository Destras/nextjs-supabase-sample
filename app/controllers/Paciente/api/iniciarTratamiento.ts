'use client'

import { createClient } from '@/lib/supabase/client'
import { serializeEntregasPlan } from '@/app/controllers/Tratamiento'
import type {
  ErrorDeInicio,
  EstadoBienvenida,
  IniciarTratamientoPayload,
  IniciarTratamientoResult,
} from '../PacienteTypes'
import { dispararInvitacion } from './dispararInvitacion'

// Forma cruda del jsonb de `iniciar_tratamiento`; no sale de este archivo.
interface IniciarTratamientoRaw {
  readonly iniciado: boolean
  readonly pacienteId: string
}

const ERRORES_CONOCIDOS: ReadonlySet<string> = new Set([
  'etapa_cerrada',
  'paciente_dado_de_baja',
  'semana_pasada',
])

const mapError = (message: string): ErrorDeInicio =>
  ERRORES_CONOCIDOS.has(message) ? (message as ErrorDeInicio) : 'desconocido'

// `enviadas` null (body sin el campo) queda 'desconocida': mejor no decir nada
// que afirmar un envío que no consta.
const bienvenidaDe = (enviadas: number | null): EstadoBienvenida => {
  if (enviadas === null) return 'desconocida'
  return enviadas > 0 ? 'enviada' : 'innecesaria'
}

const iniciarTratamiento = async (
  payload: IniciarTratamientoPayload,
): Promise<IniciarTratamientoResult> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('iniciar_tratamiento', {
    p_etapa_id: payload.etapaId,
    p_entregas_plan:
      payload.semanas === null ? null : serializeEntregasPlan(payload.semanas),
  })

  if (error) {
    return {
      ok: false,
      error: mapError(error.message),
      iniciado: false,
      bienvenida: 'desconocida',
    }
  }

  const raw = data as unknown as IniciarTratamientoRaw
  if (!raw.iniciado) {
    return { ok: true, error: null, iniciado: false, bienvenida: 'desconocida' }
  }

  // La bienvenida es un side-effect: su fallo no invalida el inicio.
  const invitacion = await dispararInvitacion(raw.pacienteId)
  return {
    ok: true,
    error: null,
    iniciado: true,
    bienvenida: invitacion.ok ? bienvenidaDe(invitacion.enviadas) : 'fallida',
  }
}

export { iniciarTratamiento }
