'use client'

import type { CerrarEtapaPayload, UpdatePacienteResult } from '../PacienteTypes'
import { cerrarEtapa } from './cerrarEtapa'
import { useSubmitMutation } from './useSubmitMutation'
import type { UseSubmitMutationResult } from './useSubmitMutation'

type UseCerrarEtapaResult = UseSubmitMutationResult<
  CerrarEtapaPayload,
  UpdatePacienteResult
>

const useCerrarEtapa = (): UseCerrarEtapaResult =>
  useSubmitMutation(cerrarEtapa)

export type { UseCerrarEtapaResult }
export { useCerrarEtapa }
