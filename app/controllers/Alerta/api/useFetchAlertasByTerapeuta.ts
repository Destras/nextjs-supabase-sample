'use client'

import { useEffect, useState } from 'react'
import type { Alerta } from '../AlertaTypes'
import { fetchAlertasByTerapeuta } from './fetchAlertasByTerapeuta'
import { useFetchTiposAlerta } from './useFetchTiposAlerta'

interface UseFetchAlertasByTerapeutaResult {
  readonly alertas: ReadonlyArray<Alerta>
  readonly isLoading: boolean
  readonly error: string | null
}

// Drill-down admin (columna Alertas de /terapeutas, Task 2.3): compone el
// catálogo (useFetchTiposAlerta, estático) con list_alertas_admin filtrado
// por terapeutaId. Null-guard: no fetchea si terapeutaId es null (patrón
// useFetchTerapeutaById) — evita una llamada antes de que la fila
// seleccionada resuelva su id. Read-only, sin refetch — a diferencia de
// useFetchAlertasTerapeuta no hay mutación (marcar/desmarcar) que reconciliar.
const useFetchAlertasByTerapeuta = (
  terapeutaId: string | null,
): UseFetchAlertasByTerapeutaResult => {
  const {
    tipos,
    isLoading: isLoadingTipos,
    error: tiposError,
  } = useFetchTiposAlerta()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [isLoadingAlertas, setIsLoadingAlertas] = useState(!!terapeutaId)
  const [alertasError, setAlertasError] = useState<string | null>(null)

  useEffect(() => {
    if (!terapeutaId) {
      setAlertas([])
      setAlertasError(null)
      setIsLoadingAlertas(false)
      return
    }

    if (isLoadingTipos) return

    if (tiposError) {
      setIsLoadingAlertas(false)
      return
    }

    let cancelled = false
    setIsLoadingAlertas(true)
    setAlertasError(null)

    const load = async () => {
      try {
        const { data, error: fetchError } = await fetchAlertasByTerapeuta(
          terapeutaId,
          tipos,
        )

        if (cancelled) return

        if (fetchError) {
          setAlertasError(fetchError.message)
          return
        }

        setAlertas(data ?? [])
      } finally {
        if (!cancelled) setIsLoadingAlertas(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [terapeutaId, isLoadingTipos, tiposError, tipos])

  return {
    alertas,
    isLoading: !!terapeutaId && (isLoadingTipos || isLoadingAlertas),
    error: terapeutaId ? (tiposError ?? alertasError) : null,
  }
}

export type { UseFetchAlertasByTerapeutaResult }
export { useFetchAlertasByTerapeuta }
