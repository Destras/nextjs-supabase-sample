'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseReplaceAndDeleteContenidoResult {
  readonly mutate: (params: {
    oldId: string
    newId: string
  }) => Promise<{ ok: boolean; affected?: number }>
  readonly isLoading: boolean
  readonly error: string | null
}

const KNOWN_ERRORS = new Set([
  'tipo_distinto',
  'no_encontrado',
  'no_autorizado',
])

const useReplaceAndDeleteContenido = (): UseReplaceAndDeleteContenidoResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    oldId,
    newId,
  }: {
    oldId: string
    newId: string
  }): Promise<{ ok: boolean; affected?: number }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc(
        'replace_and_delete_contenido',
        {
          p_old_id: oldId,
          p_new_id: newId,
        },
      )
      if (rpcError) {
        const code = KNOWN_ERRORS.has(rpcError.message)
          ? rpcError.message
          : 'replace_contenido_failed'
        setError(code)
        return { ok: false }
      }
      const rows = data as { affected: number }[] | null
      const affected = rows && rows.length > 0 ? rows[0].affected : undefined
      return { ok: true, ...(affected !== undefined ? { affected } : {}) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'replace_contenido_failed')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseReplaceAndDeleteContenidoResult }
export { useReplaceAndDeleteContenido }
