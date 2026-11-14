'use client'

import type { CerrarEtapaPayload, UpdatePacienteResult } from '../PacienteTypes'
import { callUpdateRpc } from './callUpdateRpc'

const cerrarEtapa = (
  payload: CerrarEtapaPayload,
): Promise<UpdatePacienteResult> =>
  callUpdateRpc('cerrar_etapa', {
    p_paciente_id: payload.pacienteId,
    p_estado: payload.estado,
    p_motivo: payload.motivo,
  })

export { cerrarEtapa }
