'use client'

import { createClient } from '@/lib/supabase/client'
import type { ContenidoRowRaw } from '../utils/mapContenidoRow'
import { mapContenidoRow } from '../utils/mapContenidoRow'
import type { Contenido } from '../ContenidoTypes'

const fetchContenidoById = async (
  contenidoId: string,
): Promise<{ data: Contenido | null; error: Error | null }> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('contenidos')
    .select(
      `id, tipo, titulo, descripcion, recurso_ref, duracion_seg, contenido_imagenes(path, orden)`,
    )
    .eq('activo', true)
    .eq('id', contenidoId)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  if (!data) {
    return { data: null, error: null }
  }

  return {
    data: mapContenidoRow(data as unknown as ContenidoRowRaw),
    error: null,
  }
}

export { fetchContenidoById }
