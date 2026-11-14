'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseReactivateTerapeutaResult {
  readonly mutate: (params: {
    terapeutaId: string
  }) => Promise<{ ok: boolean; error?: string }>
  readonly isLoading: boolean
  readonly error: string | null
}

// supabase-js wraps non-2xx responses into FunctionsHttpError. The raw body
// (e.g. `{ error: 'reactivate_failed' }`) lives on `error.context: Response`.
// Extract `error` so the UI can map domain codes instead of the generic
// transport message.
const extractErrorCodeFromContext = async (
  invokeError: unknown,
): Promise<string | null> => {
  const context = (
    invokeError as { context?: { json?: () => Promise<unknown> } }
  )?.context
  if (!context || typeof context.json !== 'function') {
    return null
  }
  try {
    const body = (await context.json()) as { error?: unknown } | null
    if (body && typeof body.error === 'string') {
      return body.error
    }
    return null
  } catch {
    return null
  }
}

const useReactivateTerapeuta = (): UseReactivateTerapeutaResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    terapeutaId,
  }: {
    terapeutaId: string
  }): Promise<{ ok: boolean; error?: string }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke(
        'terapeuta-invitations',
        {
          body: { action: 'reactivate', terapeutaId },
        },
      )
      if (invokeError) {
        const bodyErrorCode = await extractErrorCodeFromContext(invokeError)
        const errorCode =
          bodyErrorCode ?? invokeError.message ?? 'error_desconocido'
        setError(errorCode)
        return { ok: false, error: errorCode }
      }
      if (data?.error) {
        setError(data.error)
        return { ok: false, error: data.error }
      }
      return { ok: true }
    } catch (err) {
      const errorCode = err instanceof Error ? err.message : 'error_desconocido'
      setError(errorCode)
      return { ok: false, error: errorCode }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseReactivateTerapeutaResult }
export { useReactivateTerapeuta }
