'use client'

import { callMedicionRpc } from './callMedicionRpc'
import type { ValoresMedicionWire } from '../utils/serializeValoresMedicion'
import type { MedicionMutationResult } from '../TratamientoTypes'

interface CerrarEtapaConMedicionPayload {
  readonly pacienteId: string
  readonly motivo: string | null
  readonly valores: ValoresMedicionWire
  readonly medicionPreviaId: string | null
}

// Sin defaults deliberadamente (design part 1 §1.8): PostgREST llama por
// nombre, así que el caller siempre pasa los 4 params explícitos.
const cerrarEtapaConMedicion = (
  payload: CerrarEtapaConMedicionPayload,
): Promise<MedicionMutationResult<string>> =>
  callMedicionRpc<string>('cerrar_etapa_con_medicion', {
    p_paciente_id: payload.pacienteId,
    p_motivo: payload.motivo,
    p_valores: payload.valores,
    p_medicion_previa_id: payload.medicionPreviaId,
  })

export type { CerrarEtapaConMedicionPayload }
export { cerrarEtapaConMedicion }
