'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Terapeuta } from '../TerapeutaTypes'
import { fetchAllTerapeutas } from './fetchAllTerapeutas'

interface UseFetchAllTerapeutasResult {
  readonly terapeutas: ReadonlyArray<Terapeuta>
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => void
}

const useFetchAllTerapeutas = (): UseFetchAllTerapeutasResult => {
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAllTerapeutas()
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

export type { UseFetchAllTerapeutasResult }
export { useFetchAllTerapeutas }
