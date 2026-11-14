'use client'

import { createClient } from '@/lib/supabase/client'
import type { TipoAlerta } from '../AlertaTypes'

// Catálogo de metadata de presentación de los tipos de alerta. Fila 1:1 con
// tipos_alerta (schema en supabase/schemas/63_tipos_alerta.sql) — no
// requiere mapeo snake_case -> camelCase, las columnas ya matchean.
const fetchTiposAlerta = async (): Promise<{
  data: TipoAlerta[] | null
  error: Error | null
}> => {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('tipos_alerta')
    .select('*')
    .order('orden')

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return {
    data: data as unknown as TipoAlerta[],
    error: null,
  }
}

export { fetchTiposAlerta }
