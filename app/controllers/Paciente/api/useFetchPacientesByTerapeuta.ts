'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Paciente } from '../PacienteTypes'
import { fetchPacientesByTerapeuta } from './fetchPacientesByTerapeuta'

interface UseFetchPacientesByTerapeutaResult {
  readonly pacientes: ReadonlyArray<Paciente>
  readonly isLoading: boolean
  readonly error: string | null
  // Vuelve a pedir la lista en segundo plano: no toca `isLoading` (la pantalla
  // no vuelve al skeleton) y, si falla, conserva la lista que ya había.
  readonly refresh: () => Promise<void>
}

const useFetchPacientesByTerapeuta = (
  terapeutaId: string | null,
): UseFetchPacientesByTerapeutaResult => {
  const [pacientes, setPacientes] = useState<Paciente[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!terapeutaId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const load = async () => {
      try {
        const { data, error: fetchError } =
          await fetchPacientesByTerapeuta(terapeutaId)

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setPacientes(data ?? [])
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [terapeutaId])

  const refresh = useCallback(async (): Promise<void> => {
    if (!terapeutaId) return
    try {
      const { data, error: fetchError } =
        await fetchPacientesByTerapeuta(terapeutaId)
      if (fetchError) return
      setPacientes(data ?? [])
    } catch {
      // Un refresh fallido no rompe la pantalla: queda la lista anterior.
    }
  }, [terapeutaId])

  return { pacientes, isLoading, error, refresh }
}

export type { UseFetchPacientesByTerapeutaResult }
export { useFetchPacientesByTerapeuta }
