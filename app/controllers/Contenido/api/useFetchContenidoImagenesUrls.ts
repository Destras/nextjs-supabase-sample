'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SignedImagen {
  readonly path: string
  readonly signedUrl: string
}

interface UseFetchContenidoImagenesUrlsResult {
  readonly urls: ReadonlyArray<SignedImagen>
  readonly isLoading: boolean
  readonly error: string | null
}

// Signs every gallery path in one Storage round-trip (createSignedUrls,
// plural) instead of one createSignedUrl per image (design §8.3), same TTL
// and cancelled-cleanup-guard posture as useFetchContenidoMediaUrl.
const useFetchContenidoImagenesUrls = (
  paths: ReadonlyArray<string>,
): UseFetchContenidoImagenesUrlsResult => {
  const [urls, setUrls] = useState<ReadonlyArray<SignedImagen>>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Dependency keyed on a stable string join: callers routinely pass a fresh
  // array literal (e.g. `imagenes.map(i => i.path)`) each render, and an
  // array-identity dependency would re-run this effect every render.
  const pathsKey = paths.join(',')

  useEffect(() => {
    if (paths.length === 0) {
      setUrls([])
      setError(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setUrls([])
    setError(null)

    const load = async () => {
      const supabase = createClient()
      const { data, error: storageError } = await supabase.storage
        .from('contenidos-imagenes')
        .createSignedUrls([...paths], 3600)

      if (cancelled) return

      if (storageError || !data) {
        setError('signed_urls_failed')
        setIsLoading(false)
        return
      }

      // Each entry carries its own error/path/signedUrl (createSignedUrls
      // batches the request, not the per-object outcome) — drop any entry
      // Storage could not sign rather than surface a null path/signedUrl.
      const mapped = data
        .filter(
          (entry): entry is { error: null; path: string; signedUrl: string } =>
            entry.error === null &&
            entry.path !== null &&
            entry.signedUrl !== null,
        )
        .map((entry) => ({ path: entry.path, signedUrl: entry.signedUrl }))

      setUrls(mapped)
      setIsLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathsKey is the intentional stable dep, see comment above
  }, [pathsKey])

  return { urls, isLoading, error }
}

export type { UseFetchContenidoImagenesUrlsResult, SignedImagen }
export { useFetchContenidoImagenesUrls }
