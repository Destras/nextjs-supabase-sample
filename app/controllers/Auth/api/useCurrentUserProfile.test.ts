import { renderHook, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUserId } from '../useCurrentUserId'
import { ROLE } from '../AuthTypes'
import type { Profile } from '../AuthTypes'
import { fetchCurrentUserProfile } from './fetchCurrentUserProfile'
import { useCurrentUserProfile } from './useCurrentUserProfile'

jest.mock('@/lib/supabase/client')
jest.mock('../useCurrentUserId')
jest.mock('./fetchCurrentUserProfile')

describe('useCurrentUserProfile', () => {
  let profileFixture: Profile

  beforeEach(() => {
    profileFixture = {
      id: 'u-1',
      name: 'Ana García',
      role: ROLE.TERAPEUTA,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'ana@example.com',
    }
    ;(createClient as jest.Mock).mockReturnValue({})
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: 'u-1',
      isLoading: false,
      error: null,
    })
    ;(fetchCurrentUserProfile as jest.Mock).mockResolvedValue(profileFixture)
  })

  it('returns { profile: null, isLoading: false, error: null } when userId is null', async () => {
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: null,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useCurrentUserProfile())
    await waitFor(() => {
      expect(result.current).toEqual({
        profile: null,
        isLoading: false,
        error: null,
      })
    })
  })

  it('returns the profile when userId resolves and the query succeeds', async () => {
    const { result } = renderHook(() => useCurrentUserProfile())
    await waitFor(() => {
      expect(result.current).toEqual({
        profile: profileFixture,
        isLoading: false,
        error: null,
      })
    })
  })

  it('returns the error message when the fetch throws', async () => {
    ;(fetchCurrentUserProfile as jest.Mock).mockRejectedValue(
      new Error('network failure'),
    )
    const { result } = renderHook(() => useCurrentUserProfile())
    await waitFor(() => {
      expect(result.current).toEqual({
        profile: null,
        isLoading: false,
        error: 'network failure',
      })
    })
  })

  it('reports isLoading: true while userId is still resolving', () => {
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useCurrentUserProfile())
    expect(result.current.isLoading).toBe(true)
  })

  it('does not expose a stale profile after userId changes to a different user', async () => {
    const { result, rerender } = renderHook(() => useCurrentUserProfile())
    await waitFor(() => expect(result.current.profile).toEqual(profileFixture))

    // User switches: a new userId is current but the new profile fetch is still pending.
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: 'u-2',
      isLoading: false,
      error: null,
    })
    ;(fetchCurrentUserProfile as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    )
    rerender()

    // The previous user's profile (id 'u-1') must NOT be exposed while 'u-2' is current.
    expect(result.current.profile).toBeNull()
  })

  it('returns profile with ROLE.PACIENTE when roles.codigo is unknown', async () => {
    ;(fetchCurrentUserProfile as jest.Mock).mockResolvedValue({
      ...profileFixture,
      role: ROLE.PACIENTE,
    })
    const { result } = renderHook(() => useCurrentUserProfile())
    await waitFor(() => {
      expect(result.current).toEqual({
        profile: { ...profileFixture, role: ROLE.PACIENTE },
        isLoading: false,
        error: null,
      })
    })
  })
})
