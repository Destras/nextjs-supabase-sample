'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '../AuthTypes'
import { useCurrentUserId } from '../useCurrentUserId'
import { fetchCurrentUserProfile } from './fetchCurrentUserProfile'

interface UseCurrentUserProfileResult {
  readonly profile: Profile | null
  readonly isLoading: boolean
  readonly error: string | null
}

const useCurrentUserProfile = (): UseCurrentUserProfileResult => {
  const { userId, isLoading: isUserIdLoading } = useCurrentUserId()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isUserIdLoading) {
      setIsLoading(true)
      return
    }

    if (!userId) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      setIsLoading(true)
      try {
        const supabase = createClient()
        const result = await fetchCurrentUserProfile(supabase, userId)
        setProfile(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    load()
  }, [userId, isUserIdLoading])

  // Never expose a profile that belongs to a different user than the current
  // `userId`: on a user switch the old profile lingers in state until the new
  // fetch resolves, and consumers that gate on `profile` (e.g. the sidebar role
  // filter) would otherwise read the previous user's role during that window.
  // (Same-user refetch keeps `profile.id === userId`, so this does not flicker.)
  const currentProfile = profile && profile.id === userId ? profile : null

  return { profile: currentProfile, isLoading, error }
}

export type { UseCurrentUserProfileResult }
export { useCurrentUserProfile }
