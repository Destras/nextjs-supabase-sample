'use client'

import { useEffect, useState } from 'react'
import type { AllDiagnosticos } from '../DiagnosticoTypes'
import { fetchAllDiagnosticos } from './fetchAllDiagnosticos'

interface UseFetchAllDiagnosticosResult {
  readonly diagnosticos: AllDiagnosticos | null
  readonly isLoading: boolean
  readonly error: string | null
}

const useFetchAllDiagnosticos = (): UseFetchAllDiagnosticosResult => {
  const [diagnosticos, setDiagnosticos] = useState<AllDiagnosticos | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { data, error: fetchError } = await fetchAllDiagnosticos()

        if (fetchError) {
          setError(fetchError.message)
          return
        }

        setDiagnosticos(data)
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [])

  return { diagnosticos, isLoading, error }
}

export type { UseFetchAllDiagnosticosResult }
export { useFetchAllDiagnosticos }
