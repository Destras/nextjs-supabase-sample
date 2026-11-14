'use client'

import { createClient } from '@/lib/supabase/client'
import type { TerapeutaRpcRow } from '../utils/mapTerapeutaRpcRow'
import { mapTerapeutaRpcRow } from '../utils/mapTerapeutaRpcRow'
import type { Terapeuta } from '../TerapeutaTypes'

const fetchAllTerapeutas = async (): Promise<ReadonlyArray<Terapeuta>> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('list_terapeutas')
  if (error) throw error
  return (data ?? []).map((row: TerapeutaRpcRow) => mapTerapeutaRpcRow(row))
}

export { fetchAllTerapeutas }
