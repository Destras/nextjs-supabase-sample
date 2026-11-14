'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseInviteTerapeutaResult {
  readonly mutate: (params: {
    nombre: string
    email: string
  }) => Promise<{ ok: boolean; terapeutaId?: string; error?: string }>
  readonly isLoading: boolean
  readonly error: string | null
}

// supabase-js wraps non-2xx responses into FunctionsHttpError. The raw body
// (e.g. `{ error: 'email_duplicado' }`) lives on `error.context: Response`.
// Extract `error` from that body so UI mapping can match on the domain code
// instead of the generic transport message.
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

const useInviteTerapeuta = (): UseInviteTerapeutaResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    nombre,
    email,
  }: {
    nombre: string
    email: string
  }): Promise<{ ok: boolean; terapeutaId?: string; error?: string }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke(
        'terapeuta-invitations',
        {
          body: { action: 'invite', nombre, email },
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
      return { ok: true, terapeutaId: data?.terapeutaId }
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

export type { UseInviteTerapeutaResult }
export { useInviteTerapeuta }
