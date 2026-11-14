'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SetContenidoImagenesParams {
  readonly contenidoId: string
  readonly paths: ReadonlyArray<string>
}

interface UseSetContenidoImagenesResult {
  readonly mutate: (
    params: SetContenidoImagenesParams,
  ) => Promise<{ ok: boolean; removedPaths: ReadonlyArray<string> }>
  readonly isLoading: boolean
  readonly error: string | null
}

const KNOWN_ERRORS = new Set([
  'no_autorizado',
  'galeria_vacia',
  'no_encontrado',
])

const useSetContenidoImagenes = (): UseSetContenidoImagenesResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    contenidoId,
    paths,
  }: SetContenidoImagenesParams): Promise<{
    ok: boolean
    removedPaths: ReadonlyArray<string>
  }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc(
        'set_contenido_imagenes',
        {
          p_contenido_id: contenidoId,
          p_paths: paths,
        },
      )
      if (rpcError) {
        const code = KNOWN_ERRORS.has(rpcError.message)
          ? rpcError.message
          : 'set_imagenes_failed'
        setError(code)
        return { ok: false, removedPaths: [] }
      }
      const rows = (data as Array<{ removed_path: string }> | null) ?? []
      return { ok: true, removedPaths: rows.map((row) => row.removed_path) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'set_imagenes_failed')
      return { ok: false, removedPaths: [] }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseSetContenidoImagenesResult }
export { useSetContenidoImagenes }
