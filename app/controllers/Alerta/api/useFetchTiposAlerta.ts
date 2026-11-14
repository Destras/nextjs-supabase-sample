'use client'

import { useEffect, useState } from 'react'
import type { TipoAlerta } from '../AlertaTypes'
import { fetchTiposAlerta } from './fetchTiposAlerta'

interface UseFetchTiposAlertaResult {
  readonly tipos: ReadonlyArray<TipoAlerta>
  readonly isLoading: boolean
  readonly error: string | null
}

const useFetchTiposAlerta = (): UseFetchTiposAlertaResult => {
  const [tipos, setTipos] = useState<TipoAlerta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async (): Promise<void> => {
      setIsLoading(true)
      setError(null)

      const { data, error: fetchError } = await fetchTiposAlerta()

      if (fetchError) {
        setError(fetchError.message)
        setIsLoading(false)
        return
      }

      setTipos(data ?? [])
      setIsLoading(false)
    }

    load()
  }, [])

  return { tipos, isLoading, error }
}

export type { UseFetchTiposAlertaResult }
export { useFetchTiposAlerta }
