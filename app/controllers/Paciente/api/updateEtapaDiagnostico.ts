'use client'

import type {
  UpdateEtapaDiagnosticoPayload,
  UpdatePacienteResult,
} from '../PacienteTypes'
import { callUpdateRpc } from './callUpdateRpc'
import { aplanarAlfabetos } from '../utils/aplanarAlfabetos'

const updateEtapaDiagnostico = (
  payload: UpdateEtapaDiagnosticoPayload,
): Promise<UpdatePacienteResult> =>
  callUpdateRpc('update_etapa_diagnostico', {
    p_paciente_id: payload.pacienteId,
    p_causa_id: payload.causaId,
    p_algoritmo_id: payload.algoritmoId,
    p_modalidad_id: payload.modalidadId,
    p_bloqueo_ids: payload.bloqueoIds,
    p_alfabetos: aplanarAlfabetos(payload.alfabetos),
  })

export { updateEtapaDiagnostico }
