'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contenido } from '../ContenidoTypes'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import type { ContenidoRowRaw } from '../utils/mapContenidoRow'
import { mapContenidoRow } from '../utils/mapContenidoRow'

interface UseCreateContenidoResult {
  readonly mutate: (params: {
    readonly tipo:
      | TIPO_CONTENIDO.VIDEO
      | TIPO_CONTENIDO.AUDIO
      | TIPO_CONTENIDO.EGREGOR
    readonly titulo: string | null
    readonly descripcion: string | null
    readonly recursoRef: string
    readonly duracionSeg: number | null
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
  'recurso_ref_vacio',
])

const useCreateContenido = (): UseCreateContenidoResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    tipo,
    titulo,
    descripcion,
    recursoRef,
    duracionSeg,
  }: {
    readonly tipo:
      | TIPO_CONTENIDO.VIDEO
      | TIPO_CONTENIDO.AUDIO
      | TIPO_CONTENIDO.EGREGOR
    readonly titulo: string | null
    readonly descripcion: string | null
    readonly recursoRef: string
    readonly duracionSeg: number | null
  }): Promise<{ ok: boolean; contenido?: Contenido }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('create_contenido', {
        p_tipo: tipo.toLowerCase(),
        p_titulo: titulo,
        p_descripcion: descripcion,
        p_recurso_ref: recursoRef,
        p_duracion_seg: duracionSeg,
      })
      if (rpcError) {
        const code = KNOWN_ERRORS.has(rpcError.message)
          ? rpcError.message
          : 'create_failed'
        setError(code)
        return { ok: false }
      }
      const rows = data as ContenidoRowRaw[] | null
      const contenido =
        rows && rows.length > 0 ? mapContenidoRow(rows[0]) : undefined
      return { ok: true, ...(contenido ? { contenido } : {}) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'create_failed')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseCreateContenidoResult }
export { useCreateContenido }
