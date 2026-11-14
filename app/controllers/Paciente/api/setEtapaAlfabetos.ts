'use client'

import type {
  SetEtapaAlfabetosPayload,
  UpdatePacienteResult,
} from '../PacienteTypes'
import { callUpdateRpc } from './callUpdateRpc'
import { aplanarAlfabetos } from '../utils/aplanarAlfabetos'

const setEtapaAlfabetos = (
  payload: SetEtapaAlfabetosPayload,
): Promise<UpdatePacienteResult> =>
  callUpdateRpc('set_etapa_alfabetos', {
    p_paciente_id: payload.pacienteId,
    p_alfabetos: aplanarAlfabetos(payload.alfabetos),
  })

export { setEtapaAlfabetos }
