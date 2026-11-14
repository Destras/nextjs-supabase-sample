'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchEstructuraPaciente } from './fetchEstructuraPaciente'
import type { EstructuraPaciente } from '../TratamientoTypes'

interface UseFetchEstructuraPacienteResult {
  readonly data: EstructuraPaciente | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => void
}

const useFetchEstructuraPaciente = (
  pacienteId: string | null,
): UseFetchEstructuraPacienteResult => {
  const [data, setData] = useState<EstructuraPaciente | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(pacienteId !== null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState<number>(0)

  useEffect(() => {
    if (pacienteId === null) {
      setIsLoading(false)
      setData(null)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetchEstructuraPaciente(pacienteId)
      .then((result) => {
        if (cancelled) return
        setData(result.data)
        setError(result.error)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setData(null)
        setError(err instanceof Error ? err.message : 'Error inesperado')
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pacienteId, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return { data, isLoading, error, refresh }
}

export { useFetchEstructuraPaciente }
export type { UseFetchEstructuraPacienteResult }
