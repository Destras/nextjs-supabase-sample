import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useRevokeInvitation } from './useRevokeInvitation'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useRevokeInvitation', () => {
  let mockInvoke: jest.Mock

  beforeEach(() => {
    mockInvoke = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      functions: { invoke: mockInvoke },
    })
  })

  it('returns ok:true when invoke succeeds with no data.error', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useRevokeInvitation())
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(returnValue).toEqual({ ok: true })
  })

  it('returns error:null after a successful invoke', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useRevokeInvitation())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('returns ok:false when data.error is estado_invalido', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'estado_invalido' },
      error: null,
    })
    const { result } = renderHook(() => useRevokeInvitation())
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('sets error to estado_invalido in hook state when data.error is estado_invalido', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'estado_invalido' },
      error: null,
    })
    const { result } = renderHook(() => useRevokeInvitation())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'estado_invalido',
    })
  })

  it('returns ok:false when invokeError is present', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'delete_failed' },
    })
    const { result } = renderHook(() => useRevokeInvitation())
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('sets error to invokeError.message when invoke returns an error object', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'delete_failed' },
    })
    const { result } = renderHook(() => useRevokeInvitation())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'delete_failed',
    })
  })

  it('sets isLoading to true during the invoke and false after', async () => {
    let resolveInvoke!: (value: unknown) => void
    mockInvoke.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoke = resolve
      }),
    )
    const { result } = renderHook(() => useRevokeInvitation())

    act(() => {
      result.current.mutate({ terapeutaId: 't-1' })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveInvoke({ data: {}, error: null })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
