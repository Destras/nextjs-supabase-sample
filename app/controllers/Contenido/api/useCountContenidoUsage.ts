'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseCountContenidoUsageResult {
  readonly mutate: (params: {
    id: string
  }) => Promise<{ ok: boolean; count?: number }>
  readonly isLoading: boolean
  readonly error: string | null
}

const KNOWN_ERRORS = new Set(['no_autorizado'])

const useCountContenidoUsage = (): UseCountContenidoUsageResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    id,
  }: {
    id: string
  }): Promise<{ ok: boolean; count?: number }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc(
        'count_contenido_usage',
        {
          p_id: id,
        },
      )
      if (rpcError) {
        const code = KNOWN_ERRORS.has(rpcError.message)
          ? rpcError.message
          : 'count_contenido_failed'
        setError(code)
        return { ok: false }
      }
      return { ok: true, count: data as number }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'count_contenido_failed')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseCountContenidoUsageResult }
export { useCountContenidoUsage }
