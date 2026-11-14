'use client'

import { createClient } from '@/lib/supabase/client'
import type { TerapeutaRpcRow } from '../utils/mapTerapeutaRpcRow'
import { mapTerapeutaRpcRow } from '../utils/mapTerapeutaRpcRow'
import type { Terapeuta } from '../TerapeutaTypes'

const fetchTerapeutaById = async (
  terapeutaId: string,
): Promise<{ data: Terapeuta | null; error: Error | null }> => {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('get_terapeuta', {
    p_terapeuta_id: terapeutaId,
  })

  if (error) {
    return { data: null, error: new Error(error.message) }
  }

  if (!data || (data as TerapeutaRpcRow[]).length === 0) {
    return { data: null, error: null }
  }

  return {
    data: mapTerapeutaRpcRow((data as TerapeutaRpcRow[])[0]),
    error: null,
  }
}

export { fetchTerapeutaById }
