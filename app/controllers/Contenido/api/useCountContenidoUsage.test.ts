import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useCountContenidoUsage } from './useCountContenidoUsage'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useCountContenidoUsage', () => {
  let mockRpc: jest.Mock

  beforeEach(() => {
    mockRpc = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    })
  })

  it('returns ok:true and count when rpc succeeds', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null })
    const { result } = renderHook(() => useCountContenidoUsage())
    let returnValue: { ok: boolean; count?: number } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ id: 'c-1' })
    })
    expect(returnValue).toEqual({ ok: true, count: 3 })
  })

  it('returns error:null in hook state after a successful mutate', async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null })
    const { result } = renderHook(() => useCountContenidoUsage())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('sets error to no_autorizado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: '42501' },
    })
    const { result } = renderHook(() => useCountContenidoUsage())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_autorizado',
    })
  })

  it('sets error to count_contenido_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useCountContenidoUsage())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'count_contenido_failed',
    })
  })

  it('sets isLoading to true during rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useCountContenidoUsage())

    act(() => {
      result.current.mutate({ id: 'c-1' })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveRpc({ data: 0, error: null })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
