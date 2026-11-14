'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchEvaluacionesDelTratamientoActivo } from './fetchEvaluacionesDelTratamientoActivo'
import type { Tratamiento } from '../TratamientoTypes'

interface UseFetchEvaluacionesDelTratamientoActivoResult {
  readonly tratamiento: Tratamiento | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => void
}

const useFetchEvaluacionesDelTratamientoActivo = (
  pacienteId: string | null,
): UseFetchEvaluacionesDelTratamientoActivoResult => {
  const [tratamiento, setTratamiento] = useState<Tratamiento | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(pacienteId !== null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState<number>(0)

  useEffect(() => {
    if (pacienteId === null) {
      setIsLoading(false)
      setTratamiento(null)
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetchEvaluacionesDelTratamientoActivo(pacienteId)
      .then((result) => {
        if (cancelled) return
        setTratamiento(result.tratamiento)
        setError(result.error)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setTratamiento(null)
        setError(err instanceof Error ? err.message : 'Error inesperado')
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pacienteId, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return { tratamiento, isLoading, error, refresh }
}

export { useFetchEvaluacionesDelTratamientoActivo }
export type { UseFetchEvaluacionesDelTratamientoActivoResult }
