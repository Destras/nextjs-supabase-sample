'use client'

import type {
  RegisterPacientePayload,
  RegisterPacienteResult,
} from '../PacienteTypes'
import { registerPaciente } from './registerPaciente'
import { useSubmitMutation } from './useSubmitMutation'
import type { UseSubmitMutationResult } from './useSubmitMutation'

type UseRegisterPacienteResult = UseSubmitMutationResult<
  RegisterPacientePayload,
  RegisterPacienteResult
>

const useRegisterPaciente = (): UseRegisterPacienteResult =>
  useSubmitMutation(registerPaciente)

export type { UseRegisterPacienteResult }
export { useRegisterPaciente }
