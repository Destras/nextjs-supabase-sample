'use client'

import { useParams } from 'next/navigation'
import { useMemo } from 'react'
import {
  SLOT_DEFINITIONS,
  useFetchPlanContenidoDelTratamientoActivo,
} from '@/app/controllers/Tratamiento'
import type { FraseDerivada, SlotKey } from '@/app/controllers/Tratamiento'
import { contenidoLabel } from '@/app/controllers/Contenido'
import type { Contenido, TIPO_CONTENIDO } from '@/app/controllers/Contenido'

interface ContenidoCellData {
  readonly id: string
  readonly titulo: string
  readonly tipo: TIPO_CONTENIDO
}

interface SemanaContenidoRow {
  readonly numeroSemana: number
  readonly frases: ReadonlyArray<FraseDerivada>
  // Los 5 slots del plan, por clave de slot (BETA-020). `null` = la semana no
  // tiene contenido de ese tipo. Se arma desde SLOT_DEFINITIONS, la misma fuente
  // que usa Asignar contenido, para que las dos pantallas no se desfasen.
  readonly slots: Readonly<Record<SlotKey, ContenidoCellData | null>>
}

const toCell = (item: Contenido | undefined): ContenidoCellData | null =>
  item === undefined
    ? null
    : { id: item.id, titulo: contenidoLabel(item), tipo: item.tipo }

interface ContenidoTabViewModel {
  readonly pacienteId: string
  readonly isLoading: boolean
  readonly error: string | null
  readonly weeks: ReadonlyArray<SemanaContenidoRow>
  readonly hasContent: boolean
  readonly refresh: () => void
}

const useContenidoTabViewModel = (): ContenidoTabViewModel => {
  const params = useParams<{ id: string }>()
  const {
    tratamiento,
    semanasTotales,
    frasesPorSemana,
    isLoading,
    error,
    refresh,
  } = useFetchPlanContenidoDelTratamientoActivo(params.id)

  const hasContent =
    tratamiento !== null && tratamiento.entregasSemanales.length > 0

  const weeks = useMemo<ReadonlyArray<SemanaContenidoRow>>(() => {
    if (tratamiento === null || semanasTotales === null) return []

    return Array.from({ length: semanasTotales }, (_, i) => {
      const n = i + 1
      const entrega = tratamiento.entregasSemanales.find(
        (e) => e.numeroSemana === n,
      )
      const contenido = entrega?.contenido ?? []

      const slots = SLOT_DEFINITIONS.reduce(
        (acc, def) => {
          acc[def.key] = toCell(contenido.find((c) => c.tipo === def.source))
          return acc
        },
        {} as Record<SlotKey, ContenidoCellData | null>,
      )

      return {
        numeroSemana: n,
        slots,
        frases: frasesPorSemana[n] ?? [],
      }
    })
  }, [tratamiento, semanasTotales, frasesPorSemana])

  return {
    pacienteId: params.id,
    isLoading,
    error,
    weeks,
    hasContent,
    refresh,
  }
}

export { useContenidoTabViewModel }
export type { ContenidoTabViewModel, SemanaContenidoRow, ContenidoCellData }
