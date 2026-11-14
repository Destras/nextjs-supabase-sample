'use client'

import type {
  IniciarNuevaEtapaPayload,
  IniciarNuevaEtapaResult,
} from '../PacienteTypes'
import { iniciarNuevaEtapa } from './iniciarNuevaEtapa'
import { useSubmitMutation } from './useSubmitMutation'
import type { UseSubmitMutationResult } from './useSubmitMutation'

type UseIniciarNuevaEtapaResult = UseSubmitMutationResult<
  IniciarNuevaEtapaPayload,
  IniciarNuevaEtapaResult
>

const useIniciarNuevaEtapa = (): UseIniciarNuevaEtapaResult =>
  useSubmitMutation(iniciarNuevaEtapa)

export type { UseIniciarNuevaEtapaResult }
export { useIniciarNuevaEtapa }
