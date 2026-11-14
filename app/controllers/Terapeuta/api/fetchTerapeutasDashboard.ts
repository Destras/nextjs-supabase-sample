'use client'

import { createClient } from '@/lib/supabase/client'
import type { TerapeutaDashboardRow } from '../utils/mapTerapeutaDashboardRow'
import { mapTerapeutaDashboardRow } from '../utils/mapTerapeutaDashboardRow'
import type { TerapeutaRollup } from '../TerapeutaTypes'

// Lee el MISMO RPC list_terapeutas() que fetchAllTerapeutas, pero con el mapper
// del dashboard (lee score_promedio / alertas_activas). Extensión aditiva: no
// toca el read path existente.
const fetchTerapeutasDashboard = async (): Promise<
  ReadonlyArray<TerapeutaRollup>
> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('list_terapeutas')
  if (error) throw error
  return (data ?? []).map((row: TerapeutaDashboardRow) =>
    mapTerapeutaDashboardRow(row),
  )
}

export { fetchTerapeutasDashboard }
