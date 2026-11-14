'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ALERTA_TIPO } from '../AlertaTypes'

interface MarcarAlertaResult {
  readonly error: string | null
}

interface UseMarcarAlertaAtendidaResult {
  readonly marcar: (
    tipo: ALERTA_TIPO,
    eventoRef: string,
    pacienteId: string,
  ) => Promise<MarcarAlertaResult>
  readonly desmarcar: (
    tipo: ALERTA_TIPO,
    eventoRef: string,
    pacienteId: string,
  ) => Promise<MarcarAlertaResult>
  readonly isMarcando: boolean
  readonly error: string | null
}

// marcar_alerta_atendida / desmarcar_alerta_atendida comparten firma
// (p_tipo, p_evento_ref, p_paciente_id) y contrato void — un solo helper
// evita duplicar el envelope { error } entre las dos ramas.
const callDismissalRpc = async (
  fn: string,
  tipo: ALERTA_TIPO,
  eventoRef: string,
  pacienteId: string,
): Promise<MarcarAlertaResult> => {
  const supabase = createClient()
  const { error } = await supabase.rpc(fn, {
    p_tipo: tipo,
    p_evento_ref: eventoRef,
    p_paciente_id: pacienteId,
  })

  if (error) return { error: error.message }
  return { error: null }
}

const useMarcarAlertaAtendida = (): UseMarcarAlertaAtendidaResult => {
  const [isMarcando, setIsMarcando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runDismissal = async (
    fn: string,
    tipo: ALERTA_TIPO,
    eventoRef: string,
    pacienteId: string,
  ): Promise<MarcarAlertaResult> => {
    setIsMarcando(true)
    setError(null)
    try {
      const result = await callDismissalRpc(fn, tipo, eventoRef, pacienteId)
      if (result.error) setError(result.error)
      return result
    } finally {
      setIsMarcando(false)
    }
  }

  const marcar = (
    tipo: ALERTA_TIPO,
    eventoRef: string,
    pacienteId: string,
  ): Promise<MarcarAlertaResult> =>
    runDismissal('marcar_alerta_atendida', tipo, eventoRef, pacienteId)

  const desmarcar = (
    tipo: ALERTA_TIPO,
    eventoRef: string,
    pacienteId: string,
  ): Promise<MarcarAlertaResult> =>
    runDismissal('desmarcar_alerta_atendida', tipo, eventoRef, pacienteId)

  return { marcar, desmarcar, isMarcando, error }
}

export type { UseMarcarAlertaAtendidaResult, MarcarAlertaResult }
export { useMarcarAlertaAtendida }
