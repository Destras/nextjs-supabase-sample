'use client'

import { useCallback, useEffect, useState } from 'react'
import type { TerapeutaRollup } from '../TerapeutaTypes'
import { fetchTerapeutasDashboard } from './fetchTerapeutasDashboard'

interface UseFetchTerapeutasDashboardResult {
  readonly terapeutas: ReadonlyArray<TerapeutaRollup>
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => void
}

const useFetchTerapeutasDashboard = (): UseFetchTerapeutasDashboardResult => {
  const [terapeutas, setTerapeutas] = useState<TerapeutaRollup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchTerapeutasDashboard()
      setTerapeutas([...data])
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'Error desconocido'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { terapeutas, isLoading, error, refresh: load }
}

export type { UseFetchTerapeutasDashboardResult }
export { useFetchTerapeutasDashboard }
