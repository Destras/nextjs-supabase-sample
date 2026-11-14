'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Contenido } from '../ContenidoTypes'
import { fetchAllContenido } from './fetchAllContenido'

interface UseFetchAllContenidoResult {
  readonly contenidos: ReadonlyArray<Contenido>
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => Promise<void>
}

const useFetchAllContenido = (): UseFetchAllContenidoResult => {
  const [contenidos, setContenidos] = useState<Contenido[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (): Promise<void> => {
    const { data, error: fetchError } = await fetchAllContenido()

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    setContenidos(data ?? [])
  }, [])

  useEffect(() => {
    load().finally(() => {
      setIsLoading(false)
    })
  }, [load])

  return { contenidos, isLoading, error, refresh: load }
}

export type { UseFetchAllContenidoResult }
export { useFetchAllContenido }
