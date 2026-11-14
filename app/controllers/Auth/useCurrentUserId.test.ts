import { act, renderHook, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useCurrentUserId } from './useCurrentUserId'

jest.mock('@/lib/supabase/client')

type AuthChangeCallback = (
  event: string,
  session: { user: { id: string } } | null,
) => void

describe('useCurrentUserId', () => {
  let getUser: jest.Mock
  let onAuthStateChange: jest.Mock
  let unsubscribe: jest.Mock
  let emitAuthChange: AuthChangeCallback

  beforeEach(() => {
    getUser = jest.fn()
    unsubscribe = jest.fn()
    onAuthStateChange = jest.fn((callback: AuthChangeCallback) => {
      emitAuthChange = callback
      return { data: { subscription: { unsubscribe } } }
    })
    ;(createClient as jest.Mock).mockReturnValue({
      auth: { getUser, onAuthStateChange },
    })
  })

  it('returns the userId when the user is authenticated', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } })
    const { result } = renderHook(() => useCurrentUserId())
    await waitFor(() => {
      expect(result.current).toEqual({
        userId: 'u-1',
        error: null,
        isLoading: false,
      })
    })
  })

  it('returns an error when there is no authenticated user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useCurrentUserId())
    await waitFor(() => {
      expect(result.current).toEqual({
        userId: null,
        error: 'No autenticado',
        isLoading: false,
      })
    })
  })

  it('updates userId when onAuthStateChange emits SIGNED_IN after an initial null getUser()', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const { result } = renderHook(() => useCurrentUserId())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    expect(result.current.userId).toBeNull()
    expect(result.current.error).toBe('No autenticado')

    act(() => {
      emitAuthChange('SIGNED_IN', { user: { id: 'u-late' } })
    })

    await waitFor(() => {
      expect(result.current).toEqual({
        userId: 'u-late',
        error: null,
        isLoading: false,
      })
    })
  })

  it('clears userId when onAuthStateChange emits with a null session (SIGNED_OUT)', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } })
    const { result } = renderHook(() => useCurrentUserId())

    await waitFor(() => {
      expect(result.current.userId).toBe('u-1')
    })

    act(() => {
      emitAuthChange('SIGNED_OUT', null)
    })

    await waitFor(() => {
      expect(result.current.userId).toBeNull()
    })
  })

  it('unsubscribes from auth state changes on unmount', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } })
    const { unmount } = renderHook(() => useCurrentUserId())

    await waitFor(() => {
      expect(onAuthStateChange).toHaveBeenCalled()
    })

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
