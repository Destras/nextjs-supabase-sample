'use client'

import { useCallback } from 'react'
import type { BuscarFichaPorEmailResult } from '../PacienteTypes'
import { buscarFichaPorEmail } from './buscarFichaPorEmail'

interface UseBuscarFichaPorEmailResult {
  readonly buscar: (
    email: string,
    excluirPacienteId: string | null,
  ) => Promise<BuscarFichaPorEmailResult>
}

// Lookup imperativo, no un fetch de montaje: solo corre en el camino de error del
// alta/edición, cuando el RPC devolvió `email_duplicado` (ADR 0010). `buscar` es
// estable entre renders, igual que `check` en useCheckTelefonoEnOtraFicha.
const useBuscarFichaPorEmail = (): UseBuscarFichaPorEmailResult => {
  const buscar = useCallback(
    (
      email: string,
      excluirPacienteId: string | null,
    ): Promise<BuscarFichaPorEmailResult> =>
      buscarFichaPorEmail(email, excluirPacienteId),
    [],
  )

  return { buscar }
}

export type { UseBuscarFichaPorEmailResult }
export { useBuscarFichaPorEmail }
