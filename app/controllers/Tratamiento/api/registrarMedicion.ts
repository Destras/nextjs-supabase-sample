'use client'

import { callMedicionRpc } from './callMedicionRpc'
import type { ValoresMedicionWire } from '../utils/serializeValoresMedicion'
import type { MedicionMutationResult } from '../TratamientoTypes'

interface RegistrarMedicionPayload {
  readonly etapaId: string
  readonly valores: ValoresMedicionWire
  // Sin default deliberadamente (design part 1 §1.6): `null` significa "creo
  // que esta etapa no tiene mediciones todavía" y habilita la apertura.
  readonly medicionPreviaId: string | null
}

const registrarMedicion = (
  payload: RegistrarMedicionPayload,
): Promise<MedicionMutationResult<string>> =>
  callMedicionRpc<string>('registrar_medicion', {
    p_etapa_id: payload.etapaId,
    p_valores: payload.valores,
    p_medicion_previa_id: payload.medicionPreviaId,
  })

export type { RegistrarMedicionPayload }
export { registrarMedicion }
