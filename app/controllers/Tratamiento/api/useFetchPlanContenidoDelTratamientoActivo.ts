'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { fetchPlanContenidoDelTratamientoActivo } from './fetchPlanContenidoDelTratamientoActivo'
import type { Tratamiento, FrasesPorSemana } from '../TratamientoTypes'

interface UseFetchPlanContenidoDelTratamientoActivoResult {
  readonly tratamiento: Tratamiento | null
  readonly semanasTotales: number | null
  readonly cantidadNiveles: number | null
  readonly frasesPorSemana: FrasesPorSemana
  readonly isLoading: boolean
  readonly error: string | null
  // Vuelve a pedir el plan del mismo paciente en segundo plano: no toca
  // `isLoading`, así la grilla no parpadea al guardar (BETA-046).
  readonly refresh: () => void
}

const useFetchPlanContenidoDelTratamientoActivo = (
  pacienteId: string | null,
): UseFetchPlanContenidoDelTratamientoActivoResult => {
  const [tratamiento, setTratamiento] = useState<Tratamiento | null>(null)
  const [semanasTotales, setSemanasTotales] = useState<number | null>(null)
  const [cantidadNiveles, setCantidadNiveles] = useState<number | null>(null)
  const [frasesPorSemana, setFrasesPorSemana] = useState<FrasesPorSemana>({})
  const [isLoading, setIsLoading] = useState<boolean>(pacienteId !== null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState<number>(0)
  // El paciente del último pedido: solo un cambio de paciente muestra la carga.
  const pacienteCargado = useRef<string | null>(null)

  useEffect(() => {
    if (pacienteId === null) {
      pacienteCargado.current = null
      setIsLoading(false)
      setTratamiento(null)
      setSemanasTotales(null)
      setCantidadNiveles(null)
      setFrasesPorSemana({})
      setError(null)
      return
    }
    let cancelled = false
    if (pacienteCargado.current !== pacienteId) {
      pacienteCargado.current = pacienteId
      setIsLoading(true)
    }
    fetchPlanContenidoDelTratamientoActivo(pacienteId)
      .then((result) => {
        if (cancelled) return
        setTratamiento(result.tratamiento)
        setSemanasTotales(result.semanasTotales)
        setCantidadNiveles(result.cantidadNiveles)
        setFrasesPorSemana(result.frasesPorSemana)
        setError(result.error)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setTratamiento(null)
        setSemanasTotales(null)
        setCantidadNiveles(null)
        setFrasesPorSemana({})
        setError(err instanceof Error ? err.message : 'Error inesperado')
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pacienteId, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  return {
    tratamiento,
    semanasTotales,
    cantidadNiveles,
    frasesPorSemana,
    isLoading,
    error,
    refresh,
  }
}

export { useFetchPlanContenidoDelTratamientoActivo }
export type { UseFetchPlanContenidoDelTratamientoActivoResult }
