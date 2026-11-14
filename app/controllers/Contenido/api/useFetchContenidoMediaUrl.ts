'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseFetchContenidoMediaUrlResult {
  readonly src: string | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly retry: () => void
}

const useFetchContenidoMediaUrl = (
  recursoRef: string | null,
): UseFetchContenidoMediaUrlResult => {
  const [src, setSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!recursoRef) return

    let cancelled = false
    setIsLoading(true)
    setSrc(null)
    setError(null)

    const load = async () => {
      const supabase = createClient()
      const { data, error: storageError } = await supabase.storage
        .from('contenidos')
        .createSignedUrl(recursoRef, 3600)

      if (cancelled) return

      if (storageError || !data) {
        setError('signed_url_failed')
        setIsLoading(false)
        return
      }

      setSrc(data.signedUrl)
      setIsLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [recursoRef, nonce])

  const retry = useCallback(() => {
    setNonce((n) => n + 1)
  }, [])

  return { src, isLoading, error, retry }
}

export type { UseFetchContenidoMediaUrlResult }
export { useFetchContenidoMediaUrl }
