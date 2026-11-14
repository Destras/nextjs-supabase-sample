'use client'

import { createClient } from '@/lib/supabase/client'
import type {
  RegisterPacientePayload,
  RegisterPacienteResult,
} from '../PacienteTypes'
import { toRpcErrorCode } from '../utils/toRpcErrorCode'
import { aplanarAlfabetos } from '../utils/aplanarAlfabetos'

const registerPaciente = async (
  payload: RegisterPacientePayload,
): Promise<RegisterPacienteResult> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('register_paciente', {
    p_nombre: payload.nombre,
    p_fecha_nacimiento: payload.fechaNacimiento,
    p_email: payload.email,
    p_telefono: payload.telefono,
    p_causa_id: payload.causaId,
    p_algoritmo_id: payload.algoritmoId,
    p_modalidad_id: payload.modalidadId,
    p_bloqueo_ids: payload.bloqueoIds,
    p_alfabetos: aplanarAlfabetos(payload.alfabetos),
  })
  if (error) return { pacienteId: null, error: toRpcErrorCode(error) }
  return { pacienteId: data as string, error: null }
}

export { registerPaciente }
