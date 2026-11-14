'use client'

import { useEffect, useState } from 'react'
import type { Contenido } from '../ContenidoTypes'
import { fetchContenidoById } from './fetchContenidoById'

interface UseFetchContenidoByIdResult {
  readonly contenido: Contenido | null
  readonly isLoading: boolean
  readonly error: string | null
}

const useFetchContenidoById = (
  contenidoId: string | null,
): UseFetchContenidoByIdResult => {
  const [contenido, setContenido] = useState<Contenido | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contenidoId) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        const { data, error: fetchError } =
          await fetchContenidoById(contenidoId)

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setContenido(data)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [contenidoId])

  return { contenido, isLoading, error }
}

export type { UseFetchContenidoByIdResult }
export { useFetchContenidoById }
