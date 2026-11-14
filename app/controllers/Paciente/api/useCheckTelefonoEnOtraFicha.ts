'use client'

import { useCallback } from 'react'
import type { TelefonoEnOtraFichaResult } from '../PacienteTypes'
import { checkTelefonoEnOtraFicha } from './checkTelefonoEnOtraFicha'

interface UseCheckTelefonoEnOtraFichaResult {
  readonly check: (
    telefono: string,
    excluirPacienteId: string | null,
  ) => Promise<TelefonoEnOtraFichaResult>
}

// Deliberately NOT built on useSubmitMutation: its synchronous in-flight lock
// would drop a second check fired for a different phone number while the
// first one is still resolving (e.g. the user blurs, then blurs again with a
// corrected phone before the first RPC returns). `check` is stable across
// renders so ViewModels can call it from effects without re-triggering them.
const useCheckTelefonoEnOtraFicha = (): UseCheckTelefonoEnOtraFichaResult => {
  const check = useCallback(
    (
      telefono: string,
      excluirPacienteId: string | null,
    ): Promise<TelefonoEnOtraFichaResult> =>
      checkTelefonoEnOtraFicha(telefono, excluirPacienteId),
    [],
  )

  return { check }
}

export type { UseCheckTelefonoEnOtraFichaResult }
export { useCheckTelefonoEnOtraFicha }
