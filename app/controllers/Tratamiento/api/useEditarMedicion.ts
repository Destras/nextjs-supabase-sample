'use client'

import { useMedicionMutation } from './useMedicionMutation'
import type { UseMedicionMutationResult } from './useMedicionMutation'
import { editarMedicion } from './editarMedicion'
import type { EditarMedicionPayload } from './editarMedicion'
import type { MedicionMutationResult } from '../TratamientoTypes'

type UseEditarMedicionResult = UseMedicionMutationResult<
  EditarMedicionPayload,
  MedicionMutationResult<null>
>

const useEditarMedicion = (): UseEditarMedicionResult =>
  useMedicionMutation(editarMedicion)

export type { UseEditarMedicionResult }
export { useEditarMedicion }
