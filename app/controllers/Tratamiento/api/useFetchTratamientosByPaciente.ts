'use client'

import { useEffect, useState } from 'react'
import type { Tratamiento } from '../TratamientoTypes'
import { fetchTratamientosByPaciente } from './fetchTratamientosByPaciente'

interface UseFetchTratamientosByPacienteResult {
  readonly tratamientos: ReadonlyArray<Tratamiento>
  readonly isLoading: boolean
  readonly error: string | null
}

const useFetchTratamientosByPaciente = (
  pacienteId: string | null,
): UseFetchTratamientosByPacienteResult => {
  const [tratamientos, setTratamientos] = useState<Tratamiento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pacienteId) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        const { data, error: fetchError } =
          await fetchTratamientosByPaciente(pacienteId)

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setTratamientos(data ?? [])
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [pacienteId])

  return { tratamientos, isLoading, error }
}

export type { UseFetchTratamientosByPacienteResult }
export { useFetchTratamientosByPaciente }
