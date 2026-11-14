'use client'

import type {
  UpdateEtapaDiagnosticoPayload,
  UpdatePacienteResult,
} from '../PacienteTypes'
import { updateEtapaDiagnostico } from './updateEtapaDiagnostico'
import { useSubmitMutation } from './useSubmitMutation'
import type { UseSubmitMutationResult } from './useSubmitMutation'

type UseUpdateEtapaDiagnosticoResult = UseSubmitMutationResult<
  UpdateEtapaDiagnosticoPayload,
  UpdatePacienteResult
>

const useUpdateEtapaDiagnostico = (): UseUpdateEtapaDiagnosticoResult =>
  useSubmitMutation(updateEtapaDiagnostico)

export type { UseUpdateEtapaDiagnosticoResult }
export { useUpdateEtapaDiagnostico }
