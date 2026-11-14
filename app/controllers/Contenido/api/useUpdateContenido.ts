'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contenido } from '../ContenidoTypes'
import type { ContenidoRowRaw } from '../utils/mapContenidoRow'
import { mapContenidoRow } from '../utils/mapContenidoRow'

interface UseUpdateContenidoResult {
  readonly mutate: (params: {
    id: string
    titulo: string | null
    descripcion: string | null
  }) => Promise<{ ok: boolean; contenido?: Contenido }>
  readonly isLoading: boolean
  readonly error: string | null
}

const KNOWN_ERRORS = new Set([
  'no_autorizado',
  'tipo_invalido',
  'titulo_vacio',
  'texto_vacio',
  'no_encontrado',
])

const useUpdateContenido = (): UseUpdateContenidoResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    id,
    titulo,
    descripcion,
  }: {
    id: string
    titulo: string | null
    descripcion: string | null
  }): Promise<{ ok: boolean; contenido?: Contenido }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('update_contenido', {
        p_id: id,
        p_titulo: titulo,
        p_descripcion: descripcion,
      })
      if (rpcError) {
        const code = KNOWN_ERRORS.has(rpcError.message)
          ? rpcError.message
          : 'update_failed'
        setError(code)
        return { ok: false }
      }
      const rows = data as ContenidoRowRaw[] | null
      const contenido =
        rows && rows.length > 0 ? mapContenidoRow(rows[0]) : undefined
      return { ok: true, ...(contenido ? { contenido } : {}) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'update_failed')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseUpdateContenidoResult }
export { useUpdateContenido }
