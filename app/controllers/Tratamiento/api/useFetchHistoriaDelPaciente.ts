'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchHistoriaDelPaciente } from './fetchHistoriaDelPaciente'
import type { EtapaHistoria, CentroEnergetico } from '../TratamientoTypes'

interface UseFetchHistoriaDelPacienteResult {
  readonly etapas: ReadonlyArray<EtapaHistoria>
  readonly centros: ReadonlyArray<CentroEnergetico>
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => void
}

const useFetchHistoriaDelPaciente = (
  pacienteId: string | null,
): UseFetchHistoriaDelPacienteResult => {
  const [etapas, setEtapas] = useState<ReadonlyArray<EtapaHistoria>>([])
  const [centros, setCentros] = useState<ReadonlyArray<CentroEnergetico>>([])
  const [isLoading, setIsLoading] = useState<boolean>(pacienteId !== null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState<number>(0)

  useEffect(() => {
    if (pacienteId === null) {
      setIsLoading(false)
      setEtapas([])
      setCentros([])
      setError(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    fetchHistoriaDelPaciente(pacienteId)
      .then((result) => {
        if (cancelled) return
        setEtapas(result.etapas)
        setCentros(result.centros)
        setError(result.error)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setEtapas([])
        setCentros([])
        setError(err instanceof Error ? err.message : 'Error inesperado')
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pacienteId, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return { etapas, centros, isLoading, error, refresh }
}

export { useFetchHistoriaDelPaciente }
export type { UseFetchHistoriaDelPacienteResult }
