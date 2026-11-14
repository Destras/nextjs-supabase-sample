'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { TerapeutaRpcRow } from '../utils/mapTerapeutaRpcRow'
import { mapTerapeutaRpcRow } from '../utils/mapTerapeutaRpcRow'
import type { Terapeuta } from '../TerapeutaTypes'

interface UseUpdateTerapeutaResult {
  readonly mutate: (params: {
    terapeutaId: string
    nombre: string
    telefono: string | null
  }) => Promise<{ ok: boolean; terapeuta?: Terapeuta }>
  readonly isLoading: boolean
  readonly error: string | null
}

const useUpdateTerapeuta = (): UseUpdateTerapeutaResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    terapeutaId,
    nombre,
    telefono,
  }: {
    terapeutaId: string
    nombre: string
    telefono: string | null
  }): Promise<{ ok: boolean; terapeuta?: Terapeuta }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc('update_terapeuta', {
        p_terapeuta_id: terapeutaId,
        p_nombre: nombre,
        p_telefono: telefono,
      })
      if (rpcError) {
        const code =
          rpcError.message === 'nombre_vacio' ? 'nombre_vacio' : 'update_failed'
        setError(code)
        return { ok: false }
      }
      const rows = data as TerapeutaRpcRow[] | null
      const terapeuta =
        rows && rows.length > 0 ? mapTerapeutaRpcRow(rows[0]) : undefined
      return { ok: true, terapeuta }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'update_failed')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseUpdateTerapeutaResult }
export { useUpdateTerapeuta }
