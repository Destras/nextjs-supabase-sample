import { act, renderHook, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { usePathname } from 'next/navigation'
import { useAlertasCount } from './useAlertasCount'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

describe('useAlertasCount', () => {
  let rpcMock: jest.Mock

  beforeEach(() => {
    rpcMock = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ rpc: rpcMock })
    ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
  })

  it('returns the count once the rpc resolves', async () => {
    rpcMock.mockResolvedValue({ data: 3, error: null })
    const { result } = renderHook(() => useAlertasCount())
    await waitFor(() => {
      expect(result.current).toEqual({
        count: 3,
        isLoading: false,
        error: null,
        refetch: expect.any(Function),
      })
    })
  })

  it('stays in isLoading while the rpc call is still in flight', () => {
    rpcMock.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useAlertasCount())
    expect(result.current.isLoading).toBe(true)
  })

  it('surfaces the rpc error message when the call fails', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => useAlertasCount())
    await waitFor(() => {
      expect(result.current.error).toBe('boom')
    })
  })

  it('refetches when the window regains focus', async () => {
    rpcMock.mockResolvedValue({ data: 1, error: null })
    renderHook(() => useAlertasCount())
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledTimes(1)
    })

    act(() => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledTimes(2)
    })
  })

  it('refetches when the route (pathname) changes', async () => {
    rpcMock.mockResolvedValue({ data: 1, error: null })
    const { rerender } = renderHook(() => useAlertasCount())
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledTimes(1)
    })
    ;(usePathname as jest.Mock).mockReturnValue('/alertas')
    rerender()

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledTimes(2)
    })
  })

  it('refetch() vuelve a contar sin cambiar de ruta ni de foco', async () => {
    rpcMock.mockResolvedValue({ data: 3, error: null })
    const { result } = renderHook(() => useAlertasCount())
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledTimes(1)
    })

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledTimes(2)
    })
  })
})
