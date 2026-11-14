'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile } from '../AuthTypes'
import type { ProfileRowRaw } from '../utils/mapProfileRow'
import { mapProfileRow } from '../utils/mapProfileRow'

const fetchCurrentUserProfile = async (
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, timezone, roles(codigo)')
    .eq('id', userId)
    .single()

  if (error) {
    throw new Error(error.message)
  }

  const { data: userData } = await supabase.auth.getUser()
  const email = userData?.user?.email ?? ''

  return mapProfileRow(data as unknown as ProfileRowRaw, email)
}

export { fetchCurrentUserProfile }
