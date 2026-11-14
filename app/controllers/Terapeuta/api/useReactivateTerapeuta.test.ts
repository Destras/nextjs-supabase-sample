import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useReactivateTerapeuta } from './useReactivateTerapeuta'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useReactivateTerapeuta', () => {
  let mockInvoke: jest.Mock

  beforeEach(() => {
    mockInvoke = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      functions: { invoke: mockInvoke },
    })
  })

  it('returns ok:true when invoke succeeds with no data.error', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, terapeuta: null },
      error: null,
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(returnValue).toEqual({ ok: true })
  })

  it('returns error:null after a successful mutate', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, terapeuta: null },
      error: null,
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('returns ok:false with error code when data.error is present', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'reactivate_failed' },
      error: null,
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    let returnValue: { ok: boolean; error?: string } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(returnValue).toEqual({ ok: false, error: 'reactivate_failed' })
  })

  it('sets error to data.error code in hook state', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'reactivate_failed' },
      error: null,
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'reactivate_failed',
    })
  })

  it('returns ok:false with error from invokeError.message when invoke errors without context', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network_error' },
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    let returnValue: { ok: boolean; error?: string } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(returnValue).toEqual({ ok: false, error: 'network_error' })
  })

  it('extracts data.error from invokeError.context body when edge fn returns 4xx', async () => {
    const contextResponse = {
      json: jest.fn().mockResolvedValue({ error: 'reactivate_failed' }),
    }
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: contextResponse,
      },
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    let returnValue: { ok: boolean; error?: string } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(returnValue).toEqual({ ok: false, error: 'reactivate_failed' })
    expect(result.current.error).toBe('reactivate_failed')
  })

  it('falls back to invokeError.message when context body has no error field', async () => {
    const contextResponse = {
      json: jest.fn().mockResolvedValue({ something: 'else' }),
    }
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: contextResponse,
      },
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current.error).toBe(
      'Edge Function returned a non-2xx status code',
    )
  })

  it('falls back to invokeError.message when context body json() throws', async () => {
    const contextResponse = {
      json: jest.fn().mockRejectedValue(new Error('not json')),
    }
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: contextResponse,
      },
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current.error).toBe(
      'Edge Function returned a non-2xx status code',
    )
  })

  it('sets error to invokeError.message when invoke returns an error object', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network_error' },
    })
    const { result } = renderHook(() => useReactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'network_error',
    })
  })

  it('sets isLoading to true during invoke and false after', async () => {
    let resolveInvoke!: (value: unknown) => void
    mockInvoke.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoke = resolve
      }),
    )
    const { result } = renderHook(() => useReactivateTerapeuta())

    act(() => {
      result.current.mutate({ terapeutaId: 't-1' })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveInvoke({ data: { ok: true, terapeuta: null }, error: null })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
