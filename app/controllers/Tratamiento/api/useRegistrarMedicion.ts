'use client'

import { useMedicionMutation } from './useMedicionMutation'
import type { UseMedicionMutationResult } from './useMedicionMutation'
import { registrarMedicion } from './registrarMedicion'
import type { RegistrarMedicionPayload } from './registrarMedicion'
import type { MedicionMutationResult } from '../TratamientoTypes'

type UseRegistrarMedicionResult = UseMedicionMutationResult<
  RegistrarMedicionPayload,
  MedicionMutationResult<string>
>

const useRegistrarMedicion = (): UseRegistrarMedicionResult =>
  useMedicionMutation(registrarMedicion)

export type { UseRegistrarMedicionResult }
export { useRegistrarMedicion }
