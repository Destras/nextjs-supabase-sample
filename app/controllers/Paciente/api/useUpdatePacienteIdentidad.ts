'use client'

import type {
  UpdatePacienteIdentidadPayload,
  UpdatePacienteResult,
} from '../PacienteTypes'
import { updatePacienteIdentidad } from './updatePacienteIdentidad'
import { useSubmitMutation } from './useSubmitMutation'
import type { UseSubmitMutationResult } from './useSubmitMutation'

type UseUpdatePacienteIdentidadResult = UseSubmitMutationResult<
  UpdatePacienteIdentidadPayload,
  UpdatePacienteResult
>

const useUpdatePacienteIdentidad = (): UseUpdatePacienteIdentidadResult =>
  useSubmitMutation(updatePacienteIdentidad)

export type { UseUpdatePacienteIdentidadResult }
export { useUpdatePacienteIdentidad }
