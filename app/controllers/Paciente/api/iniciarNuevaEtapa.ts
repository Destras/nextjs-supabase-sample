'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  IniciarNuevaEtapaPayload,
  IniciarNuevaEtapaResult,
} from '../PacienteTypes'
import { aplanarAlfabetos } from '../utils/aplanarAlfabetos'
import { toRpcErrorCode } from '../utils/toRpcErrorCode'

const iniciarNuevaEtapa = async (
  payload: IniciarNuevaEtapaPayload,
): Promise<IniciarNuevaEtapaResult> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('iniciar_nueva_etapa', {
    p_paciente_id: payload.pacienteId,
    p_causa_id: payload.causaId,
    p_algoritmo_id: payload.algoritmoId,
    p_modalidad_id: payload.modalidadId,
    p_bloqueo_ids: payload.bloqueoIds,
    p_alfabetos: aplanarAlfabetos(payload.alfabetos),
  })
  if (error) return { etapaId: null, error: toRpcErrorCode(error) }
  return { etapaId: data as string, error: null }
}

export { iniciarNuevaEtapa }
