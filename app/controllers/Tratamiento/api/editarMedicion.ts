'use client'

import { callMedicionRpc } from './callMedicionRpc'
import type { ValoresMedicionWire } from '../utils/serializeValoresMedicion'
import type { MedicionMutationResult } from '../TratamientoTypes'

interface EditarMedicionPayload {
  readonly medicionId: string
  readonly valores: ValoresMedicionWire
}

const editarMedicion = (
  payload: EditarMedicionPayload,
): Promise<MedicionMutationResult<null>> =>
  callMedicionRpc<null>('editar_medicion', {
    p_medicion_id: payload.medicionId,
    p_valores: payload.valores,
  })

export type { EditarMedicionPayload }
export { editarMedicion }
