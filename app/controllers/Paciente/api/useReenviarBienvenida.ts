'use client'

import { useRef, useState } from 'react'
import type { ResultadoReenvio } from '../PacienteTypes'
import { dispararInvitacion } from './dispararInvitacion'

interface UseReenviarBienvenidaResult {
  readonly reenviar: (pacienteId: string) => Promise<ResultadoReenvio>
  readonly isSending: boolean
}

const resultadoDe = (
  ok: boolean,
  enviadas: number | null,
): ResultadoReenvio => {
  if (!ok || enviadas === null) return 'error'
  return enviadas > 0 ? 'enviada' : 'innecesaria'
}

const useReenviarBienvenida = (): UseReenviarBienvenidaResult => {
  const [isSending, setIsSending] = useState(false)
  const inFlightRef = useRef<Promise<ResultadoReenvio> | null>(null)

  const reenviar = (pacienteId: string): Promise<ResultadoReenvio> => {
    if (inFlightRef.current) return inFlightRef.current
    setIsSending(true)
    const promise = (async () => {
      try {
        const r = await dispararInvitacion(pacienteId)
        return resultadoDe(r.ok, r.enviadas)
      } finally {
        setIsSending(false)
        inFlightRef.current = null
      }
    })()
    inFlightRef.current = promise
    return promise
  }

  return { reenviar, isSending }
}

export type { UseReenviarBienvenidaResult }
export { useReenviarBienvenida }
