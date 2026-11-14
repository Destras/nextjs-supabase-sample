'use client'

import { useEffect, useState } from 'react'
import type { Alerta, TipoAlerta } from '../AlertaTypes'
import { fetchAlertasTerapeuta } from './fetchAlertasTerapeuta'
import { useFetchTiposAlerta } from './useFetchTiposAlerta'

interface UseFetchAlertasTerapeutaResult {
  readonly alertas: ReadonlyArray<Alerta>
  readonly tipos: ReadonlyArray<TipoAlerta>
  readonly isLoading: boolean
  readonly error: string | null
  readonly refetch: () => void
}

// Compone el catálogo (useFetchTiposAlerta, estático) con el fetch de
// alertas activas del terapeuta. `refetch` sólo reintenta el fetch de
// alertas — el catálogo no cambia entre reconciliaciones tras marcar/desmarcar.
const useFetchAlertasTerapeuta = (): UseFetchAlertasTerapeutaResult => {
  const {
    tipos,
    isLoading: isLoadingTipos,
    error: tiposError,
  } = useFetchTiposAlerta()
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [isLoadingAlertas, setIsLoadingAlertas] = useState(true)
  const [alertasError, setAlertasError] = useState<string | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
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
        const { data, error: fetchError } = await fetchAlertasTerapeuta(tipos)

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
  }, [isLoadingTipos, tiposError, tipos, refreshTick])

  const refetch = (): void => setRefreshTick((tick) => tick + 1)

  return {
    alertas,
    tipos,
    isLoading: isLoadingTipos || isLoadingAlertas,
    error: tiposError ?? alertasError,
    refetch,
  }
}

export type { UseFetchAlertasTerapeutaResult }
export { useFetchAlertasTerapeuta }
