'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AdminDashboardStats } from '../AdminDashboardTypes'
import { fetchAdminDashboardStats } from './fetchAdminDashboardStats'

interface UseFetchAdminDashboardStatsResult {
  readonly stats: AdminDashboardStats | null
  readonly isLoading: boolean
  readonly error: string | null
  readonly refresh: () => void
}

const useFetchAdminDashboardStats = (): UseFetchAdminDashboardStatsResult => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchAdminDashboardStats()
      setStats(data)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'Error desconocido'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { stats, isLoading, error, refresh: load }
}

export type { UseFetchAdminDashboardStatsResult }
export { useFetchAdminDashboardStats }
