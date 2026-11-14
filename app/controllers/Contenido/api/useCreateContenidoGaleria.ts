'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Contenido } from '../ContenidoTypes'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import { mapContenidoRow } from '../utils/mapContenidoRow'

interface CreateContenidoGaleriaParams {
  readonly tipo: TIPO_CONTENIDO.CMA | TIPO_CONTENIDO.IC
  readonly titulo: string | null
  readonly descripcion: string | null
  readonly paths: ReadonlyArray<string>
}

interface UseCreateContenidoGaleriaResult {
  readonly mutate: (
    params: CreateContenidoGaleriaParams,
  ) => Promise<{ ok: boolean; contenido?: Contenido }>
  readonly isLoading: boolean
  readonly error: string | null
}

const KNOWN_ERRORS = new Set([
  'no_autorizado',
  'tipo_invalido',
  'titulo_vacio',
  'galeria_vacia',
])

// create_contenido_galeria only returns { id, tipo, titulo, descripcion } —
// recurso_ref/duracion_seg are always null for a gallery (design §3 ADR-3).
// `orden` is server-derived via `with ordinality`, but since it densifies
// 1..N over p_paths in the exact array order the client sent, the client can
// reconstruct the resulting imagenes without a second round-trip.
const mapCreatedGaleriaRow = (
  row: { id: string; tipo: string; titulo: string; descripcion: string | null },
  paths: ReadonlyArray<string>,
): Contenido | null =>
  mapContenidoRow({
    id: row.id,
    tipo: row.tipo,
    titulo: row.titulo,
    descripcion: row.descripcion,
    recurso_ref: null,
    duracion_seg: null,
    contenido_imagenes: paths.map((path, index) => ({
      path,
      orden: index + 1,
    })),
  })

const useCreateContenidoGaleria = (): UseCreateContenidoGaleriaResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    tipo,
    titulo,
    descripcion,
    paths,
  }: CreateContenidoGaleriaParams): Promise<{
    ok: boolean
    contenido?: Contenido
  }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc(
        'create_contenido_galeria',
        {
          p_tipo: tipo.toLowerCase(),
          p_titulo: titulo,
          p_descripcion: descripcion,
          p_paths: paths,
        },
      )
      if (rpcError) {
        const code = KNOWN_ERRORS.has(rpcError.message)
          ? rpcError.message
          : 'create_galeria_failed'
        setError(code)
        return { ok: false }
      }
      const rows = data as Array<{
        id: string
        tipo: string
        titulo: string
        descripcion: string | null
      }> | null
      const contenido =
        rows && rows.length > 0
          ? mapCreatedGaleriaRow(rows[0], paths)
          : undefined
      return { ok: true, ...(contenido ? { contenido } : {}) }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'create_galeria_failed')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseCreateContenidoGaleriaResult }
export { useCreateContenidoGaleria }
