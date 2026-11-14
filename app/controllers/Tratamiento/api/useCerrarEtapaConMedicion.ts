'use client'

import { useMedicionMutation } from './useMedicionMutation'
import type { UseMedicionMutationResult } from './useMedicionMutation'
import { cerrarEtapaConMedicion } from './cerrarEtapaConMedicion'
import type { CerrarEtapaConMedicionPayload } from './cerrarEtapaConMedicion'
import type { MedicionMutationResult } from '../TratamientoTypes'

type UseCerrarEtapaConMedicionResult = UseMedicionMutationResult<
  CerrarEtapaConMedicionPayload,
  MedicionMutationResult<string>
>

const useCerrarEtapaConMedicion = (): UseCerrarEtapaConMedicionResult =>
  useMedicionMutation(cerrarEtapaConMedicion)

export type { UseCerrarEtapaConMedicionResult }
export { useCerrarEtapaConMedicion }
