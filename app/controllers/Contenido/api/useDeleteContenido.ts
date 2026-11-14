'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface DeleteContenidoOutcome {
  readonly ok: boolean
  readonly error?: string
}

interface UseDeleteContenidoResult {
  readonly mutate: (params: { id: string }) => Promise<DeleteContenidoOutcome>
  readonly isLoading: boolean
  readonly error: string | null
}

const KNOWN_ERRORS = new Set(['en_uso', 'no_encontrado', 'no_autorizado'])

const useDeleteContenido = (): UseDeleteContenidoResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    id,
  }: {
    id: string
  }): Promise<DeleteContenidoOutcome> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('delete_contenido', {
        p_id: id,
      })
      if (rpcError) {
        const code = KNOWN_ERRORS.has(rpcError.message)
          ? rpcError.message
          : 'delete_contenido_failed'
        setError(code)
        return { ok: false, error: code }
      }
      return { ok: true }
    } catch (err) {
      const code =
        err instanceof Error ? err.message : 'delete_contenido_failed'
      setError(code)
      return { ok: false, error: code }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseDeleteContenidoResult, DeleteContenidoOutcome }
export { useDeleteContenido }
