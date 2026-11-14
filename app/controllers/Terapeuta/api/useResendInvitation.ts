'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseResendInvitationResult {
  readonly mutate: (params: { terapeutaId: string }) => Promise<{ ok: boolean }>
  readonly isLoading: boolean
  readonly error: string | null
}

const useResendInvitation = (): UseResendInvitationResult => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mutate = async ({
    terapeutaId,
  }: {
    terapeutaId: string
  }): Promise<{ ok: boolean }> => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke(
        'terapeuta-invitations',
        {
          body: { action: 'resend', terapeutaId },
        },
      )
      if (invokeError) {
        setError(invokeError.message || 'error_desconocido')
        return { ok: false }
      }
      if (data?.error) {
        setError(data.error)
        return { ok: false }
      }
      return { ok: true }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'error_desconocido')
      return { ok: false }
    } finally {
      setIsLoading(false)
    }
  }

  return { mutate, isLoading, error }
}

export type { UseResendInvitationResult }
export { useResendInvitation }
