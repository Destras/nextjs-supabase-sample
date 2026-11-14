'use client'

import { createClient } from '@/lib/supabase/client'
import type { Alerta, TipoAlerta } from '../AlertaTypes'
import type { AlertaRow } from '../utils/mapAlertaRow'
import { mapAlertaRow } from '../utils/mapAlertaRow'

// Drill-down admin (columna Alertas de /terapeutas): alertas activas de un
// terapeuta puntual. Scoping en list_alertas_admin (guard is_admin() +
// filtro por p_terapeuta_id) — ver supabase/schemas/67_alertas_admin.sql. El
// catalogo (tipos_alerta) se recibe como argumento, igual que
// fetchAlertasTerapeuta, para no duplicar la llamada que ya resuelve
// useFetchTiposAlerta.
const fetchAlertasByTerapeuta = async (
  terapeutaId: string,
  catalogo: ReadonlyArray<TipoAlerta>,
): Promise<{ data: Alerta[] | null; error: Error | null }> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('list_alertas_admin', {
    p_terapeuta_id: terapeutaId,
  })

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

export { fetchAlertasByTerapeuta }
