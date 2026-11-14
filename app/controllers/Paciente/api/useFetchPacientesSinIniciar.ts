'use client'

import { useEffect, useState } from 'react'
import type { PacienteSinIniciar } from '../PacienteTypes'
import { fetchPacientesSinIniciar } from './fetchPacientesSinIniciar'

interface UseFetchPacientesSinIniciarResult {
  readonly pacientes: ReadonlyArray<PacienteSinIniciar>
  readonly isLoading: boolean
  readonly error: string | null
}

const useFetchPacientesSinIniciar = (
  terapeutaId: string | null,
): UseFetchPacientesSinIniciarResult => {
  const [pacientes, setPacientes] = useState<PacienteSinIniciar[]>([])
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
          await fetchPacientesSinIniciar(terapeutaId)
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

  return { pacientes, isLoading, error }
}

export type { UseFetchPacientesSinIniciarResult }
export { useFetchPacientesSinIniciar }
