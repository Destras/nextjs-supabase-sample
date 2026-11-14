'use client'

import type {
  IniciarTratamientoPayload,
  IniciarTratamientoResult,
} from '../PacienteTypes'
import { iniciarTratamiento } from './iniciarTratamiento'
import { useSubmitMutation } from './useSubmitMutation'
import type { UseSubmitMutationResult } from './useSubmitMutation'

type UseIniciarTratamientoResult = UseSubmitMutationResult<
  IniciarTratamientoPayload,
  IniciarTratamientoResult
>

const useIniciarTratamiento = (): UseIniciarTratamientoResult =>
  useSubmitMutation(iniciarTratamiento)

export type { UseIniciarTratamientoResult }
export { useIniciarTratamiento }
