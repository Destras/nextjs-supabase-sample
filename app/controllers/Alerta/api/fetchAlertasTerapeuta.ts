'use client'

import { createClient } from '@/lib/supabase/client'
import type { Alerta, TipoAlerta } from '../AlertaTypes'
import type { AlertaRow } from '../utils/mapAlertaRow'
import { mapAlertaRow } from '../utils/mapAlertaRow'

// Alertas activas del caseload propio del terapeuta autenticado. El scoping
// por auth.uid() vive server-side en list_alertas_terapeuta() — sin params
// acá. El catalogo (tipos_alerta) se recibe como argumento en lugar de
// fetchearse en esta función para no duplicar la llamada que ya resuelve
// useFetchTiposAlerta.
const fetchAlertasTerapeuta = async (
  catalogo: ReadonlyArray<TipoAlerta>,
): Promise<{ data: Alerta[] | null; error: Error | null }> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('list_alertas_terapeuta')

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  return {
    data: (data as unknown as AlertaRow[]).map((row) =>
      mapAlertaRow(row, catalogo),
    ),
    error: null,
  }
}

export { fetchAlertasTerapeuta }
