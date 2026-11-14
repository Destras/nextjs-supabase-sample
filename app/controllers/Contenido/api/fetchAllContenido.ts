'use client'

import { createClient } from '@/lib/supabase/client'
import type { ContenidoRowRaw } from '../utils/mapContenidoRow'
import { mapContenidoRow } from '../utils/mapContenidoRow'
import type { Contenido } from '../ContenidoTypes'

const fetchAllContenido = async (): Promise<{
  data: Contenido[] | null
  error: Error | null
}> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contenidos')
    .select(
      `id, tipo, titulo, descripcion, recurso_ref, duracion_seg, contenido_imagenes(path, orden)`,
    )
    .eq('activo', true)

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  const mapped = (data as unknown as ContenidoRowRaw[])
    .map(mapContenidoRow)
    .filter((c): c is Contenido => c !== null)

  return { data: mapped, error: null }
}

export { fetchAllContenido }
