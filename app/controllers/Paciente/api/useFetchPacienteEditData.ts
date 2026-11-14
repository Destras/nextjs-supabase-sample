'use client'

import { useEffect, useState } from 'react'
import type { PacienteEditData } from '../PacienteTypes'
import { fetchPacienteEditData } from './fetchPacienteEditData'

interface UseFetchPacienteEditDataResult {
  readonly data: PacienteEditData | null
  readonly isLoading: boolean
  readonly error: string | null
}

const useFetchPacienteEditData = (
  pacienteId: string | null,
): UseFetchPacienteEditDataResult => {
  const [data, setData] = useState<PacienteEditData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Clear any previous paciente's record so a consumer never reads stale data
    // attributed to the new id while the refetch is in flight.
    setData(null)

    if (!pacienteId) {
      setError(null)
      setIsLoading(false)
      return
    }

    // Guard against a slow fetch for a previous pacienteId resolving after the
    // id changed and overwriting the new paciente's state (race on fast route
    // switches). The cleanup flips `cancelled` so the stale load is a no-op.
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const load = async () => {
      try {
        const { data, error: fetchError } =
          await fetchPacienteEditData(pacienteId)

        if (cancelled) return

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setData(data)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [pacienteId])

  return { data, isLoading, error }
}

export type { UseFetchPacienteEditDataResult }
export { useFetchPacienteEditData }
