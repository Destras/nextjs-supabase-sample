'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseDeactivateTerapeutaResult {
  readonly mutate: (params: {
    terapeutaId: string
    motivo: string
  }) => Promise<{ ok: boolean; error?: string; errorCount?: number | null }>
  readonly isLoading: boolean
  readonly error: string | null
  readonly errorCount: number | null
}

// supabase-js wraps non-2xx responses into FunctionsHttpError. The raw body
// (e.g. `{ error: 'no_puede_autodesactivarse' }`) lives on `error.context: Response`.
// Extract both `error` and optional `count` from that body so the UI can map
// domain codes (and patient counts) instead of the generic transport message.
const extractErrorBodyFromContext = async (
  invokeError: unknown,
): Promise<{ error: string | null; count: number | null }> => {
  const context = (
    invokeError as { context?: { json?: () => Promise<unknown> } }
  )?.context
  if (!context || typeof context.json !== 'function') {
    return { error: null, count: null }
  }
  try {
    const body = (await context.json()) as {
      error?: unknown
      count?: unknown
    } | null
    const errorCode = body && typeof body.error === 'string' ? body.error : null
    const count = body && typeof body.count === 'number' ? body.count : null
    return { error: errorCode, count }
  } catch {
    return { error: null, count: null }
  }
}

const useDeactivateTerapeuta = (): UseDeactivateTerapeutaResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCount, setErrorCount] = useState<number | null>(null)

  const mutate = async ({
    terapeutaId,
    motivo,
  }: {
    terapeutaId: string
    motivo: string
  }): Promise<{
    ok: boolean
    error?: string
    errorCount?: number | null
  }> => {
    setIsLoading(true)
    setError(null)
    setErrorCount(null)
    try {
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke(
        'terapeuta-invitations',
        {
          body: { action: 'deactivate', terapeutaId, motivo },
        },
      )
      if (invokeError) {
        const body = await extractErrorBodyFromContext(invokeError)
        const code = body.error ?? invokeError.message ?? 'error_desconocido'
        if (code === 'tiene_pacientes_activos') {
          setError(code)
          setErrorCount(body.count)
          return { ok: false, error: code, errorCount: body.count }
        }
        if (
          code === 'no_puede_autodesactivarse' ||
          code === 'motivo_requerido'
        ) {
          setError(code)
          return { ok: false, error: code }
        }
        setError(code)
        return { ok: false, error: code }
      }
      if (data?.error) {
        const code: string = data.error
        if (code === 'tiene_pacientes_activos') {
          const count: number | null =
            typeof data.count === 'number' ? data.count : null
          setError(code)
          setErrorCount(count)
          return { ok: false, error: code, errorCount: count }
        }
        if (
          code === 'no_puede_autodesactivarse' ||
          code === 'motivo_requerido'
        ) {
          setError(code)
          return { ok: false, error: code }
        }
        setError('deactivate_failed')
        return { ok: false, error: 'deactivate_failed' }
      }
      return { ok: true }
    } catch (err) {
      const code = err instanceof Error ? err.message : 'error_desconocido'
      setError(code)
      return { ok: false, error: code }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error, errorCount }
}

export type { UseDeactivateTerapeutaResult }
export { useDeactivateTerapeuta }
