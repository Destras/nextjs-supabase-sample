'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { serializeEntregasPlan } from '../utils/serializeEntregasPlan'
import type { SemanaContenido } from '../utils/serializeEntregasPlan'

interface SetEntregasPlanResult {
  readonly ok: boolean
  readonly error: string | null
  /**
   * Número de la semana ya vencida cuando el RPC rechaza con `semana_pasada`
   * (viene en el `details` del error); `null` en cualquier otro caso.
   */
  readonly semanaPasada: number | null
}

interface UseSetEntregasPlanResult {
  readonly submit: (
    etapaId: string,
    semanas: ReadonlyArray<SemanaContenido>,
  ) => Promise<SetEntregasPlanResult>
  readonly isSubmitting: boolean
  readonly error: string | null
}

const useSetEntregasPlan = (): UseSetEntregasPlanResult => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Each call persists its OWN draft. Accidental double-submit is prevented by
  // the caller (Save button disabled while isSubmitting); two full-replaces on
  // the same etapa serialize in the DB (last-write-wins = latest draft).
  const submit = async (
    etapaId: string,
    semanas: ReadonlyArray<SemanaContenido>,
  ): Promise<SetEntregasPlanResult> => {
    setIsSubmitting(true)
    setError(null)
    try {
      const rows = serializeEntregasPlan(semanas)
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('set_entregas_plan', {
        p_etapa_id: etapaId,
        p_entregas_plan: rows,
      })

      if (rpcError) {
        const msg = rpcError.message
        setError(msg)
        const semana = Number(rpcError.details)
        return {
          ok: false,
          error: msg,
          semanaPasada:
            msg === 'semana_pasada' && Number.isFinite(semana) ? semana : null,
        }
      }

      return { ok: true, error: null, semanaPasada: null }
    } finally {
      setIsSubmitting(false)
    }
  }

  return { submit, isSubmitting, error }
}

export type { UseSetEntregasPlanResult, SetEntregasPlanResult }
export { useSetEntregasPlan }
