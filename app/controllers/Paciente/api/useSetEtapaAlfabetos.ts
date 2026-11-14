'use client'

import type {
  SetEtapaAlfabetosPayload,
  UpdatePacienteResult,
} from '../PacienteTypes'
import { setEtapaAlfabetos } from './setEtapaAlfabetos'
import { useSubmitMutation } from './useSubmitMutation'
import type { UseSubmitMutationResult } from './useSubmitMutation'

type UseSetEtapaAlfabetosResult = UseSubmitMutationResult<
  SetEtapaAlfabetosPayload,
  UpdatePacienteResult
>

const useSetEtapaAlfabetos = (): UseSetEtapaAlfabetosResult =>
  useSubmitMutation(setEtapaAlfabetos)

export type { UseSetEtapaAlfabetosResult }
export { useSetEtapaAlfabetos }
