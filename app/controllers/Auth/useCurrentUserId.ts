'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseCurrentUserIdResult {
  userId: string | null
  error: string | null
  isLoading: boolean
}

const useCurrentUserId = (): UseCurrentUserIdResult => {
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const resolveUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('No autenticado')
      } else {
        setUserId(user.id)
        setError(null)
      }
      setIsLoading(false)
    }

    resolveUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        setError(null)
        setIsLoading(false)
      } else {
        setUserId(null)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { userId, error, isLoading }
}

export type { UseCurrentUserIdResult }
export { useCurrentUserId }
