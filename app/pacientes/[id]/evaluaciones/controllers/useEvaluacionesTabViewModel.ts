'use client'

import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import { useFetchEvaluacionesDelTratamientoActivo } from '@/app/controllers/Tratamiento'

interface ChartSlot {
  readonly nivelId: string
  readonly numeroNivel: number
  readonly score: number
  readonly realScore: number | null
  readonly isPending: boolean
}

interface CompletedEvaluacionRow {
  readonly nivelId: string
  readonly numeroNivel: number
  readonly fechaRespuesta: string
  readonly score: number
  readonly variation: number | 'baseline'
}

interface EvaluacionesTabViewModel {
  readonly pacienteId: string
  readonly isLoading: boolean
  readonly error: string | null
  readonly chartSlots: ReadonlyArray<ChartSlot>
  readonly completedEvaluations: ReadonlyArray<CompletedEvaluacionRow>
  readonly hasActiveTreatment: boolean
  // false when the etapa exists but has not started yet (fechaInicio null —
  // INI-002). Distinguishes "no etapa at all" from "etapa sin arrancar" so
  // the View can render a copy that doesn't contradict the ficha's header.
  readonly hasStarted: boolean
  readonly refresh: () => void
}

const useEvaluacionesTabViewModel = (): EvaluacionesTabViewModel => {
  const params = useParams<{ id: string }>()
  const { tratamiento, isLoading, error, refresh } =
    useFetchEvaluacionesDelTratamientoActivo(params.id)

  const hasActiveTreatment = tratamiento !== null
  const hasStarted = tratamiento !== null && tratamiento.fechaInicio !== null

  const chartSlots = useMemo<ReadonlyArray<ChartSlot>>(() => {
    if (tratamiento === null) return []
    return [...tratamiento.niveles]
      .sort((a, b) => a.numeroNivel - b.numeroNivel)
      .map((nivel) => {
        const isPending = nivel.evaluacion === null
        return {
          nivelId: nivel.id,
          numeroNivel: nivel.numeroNivel,
          score: isPending ? 5 : nivel.evaluacion!.score,
          realScore: isPending ? null : nivel.evaluacion!.score,
          isPending,
        }
      })
  }, [tratamiento])

  const completedEvaluations = useMemo<
    ReadonlyArray<CompletedEvaluacionRow>
  >(() => {
    if (tratamiento === null) return []
    const completed = tratamiento.niveles
      .filter((n) => n.evaluacion !== null)
      .map((n) => ({ nivel: n, evaluacion: n.evaluacion! }))
      .sort((a, b) => {
        const dateA = new Date(a.evaluacion.fechaRespuesta).getTime()
        const dateB = new Date(b.evaluacion.fechaRespuesta).getTime()
        if (dateA !== dateB) return dateA - dateB
        // DEC-12: tie-breaker — lower numeroNivel ranks as older (appears earlier in ASC)
        return a.nivel.numeroNivel - b.nivel.numeroNivel
      })
    const withVariation: ReadonlyArray<CompletedEvaluacionRow> = completed.map(
      (item, idx) => ({
        nivelId: item.nivel.id,
        numeroNivel: item.nivel.numeroNivel,
        fechaRespuesta: item.evaluacion.fechaRespuesta,
        score: item.evaluacion.score,
        variation:
          idx === 0
            ? 'baseline'
            : item.evaluacion.score - completed[idx - 1].evaluacion.score,
      }),
    )
    return [...withVariation].reverse()
  }, [tratamiento])

  return {
    pacienteId: params.id,
    isLoading,
    error,
    chartSlots,
    completedEvaluations,
    hasActiveTreatment,
    hasStarted,
    refresh,
  }
}

export { useEvaluacionesTabViewModel }
export type { EvaluacionesTabViewModel, ChartSlot, CompletedEvaluacionRow }
