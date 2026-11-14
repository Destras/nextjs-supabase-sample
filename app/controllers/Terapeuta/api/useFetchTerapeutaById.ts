'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Terapeuta } from '../TerapeutaTypes'
import { fetchTerapeutaById } from './fetchTerapeutaById'

interface UseFetchTerapeutaByIdResult {
  readonly terapeuta: Terapeuta | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => void
}

const useFetchTerapeutaById = (
  terapeutaId: string | null,
): UseFetchTerapeutaByIdResult => {
  const [terapeuta, setTerapeuta] = useState<Terapeuta | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!terapeutaId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await fetchTerapeutaById(terapeutaId)

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setTerapeuta(data)
    } finally {
      setIsLoading(false)
    }
  }, [terapeutaId])

  useEffect(() => {
    load()
  }, [load])

  return { terapeuta, isLoading, error, refresh: load }
}

export type { UseFetchTerapeutaByIdResult }
export { useFetchTerapeutaById }
