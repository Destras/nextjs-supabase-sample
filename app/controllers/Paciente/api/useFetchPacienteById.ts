'use client'

import { useEffect, useState } from 'react'
import type { Paciente } from '../PacienteTypes'
import { fetchPacienteById } from './fetchPacienteById'

interface UseFetchPacienteByIdResult {
  readonly paciente: Paciente | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly refetch: () => void
}

const useFetchPacienteById = (
  pacienteId: string | null,
): UseFetchPacienteByIdResult => {
  const [paciente, setPaciente] = useState<Paciente | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    if (!pacienteId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    const load = async () => {
      try {
        const { data, error: fetchError } = await fetchPacienteById(pacienteId)

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setPaciente(data)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [pacienteId, refreshTick])

  const refetch = (): void => setRefreshTick((tick) => tick + 1)

  return { paciente, isLoading, error, refetch }
}

export type { UseFetchPacienteByIdResult }
export { useFetchPacienteById }
