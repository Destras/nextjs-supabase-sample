import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useInviteTerapeuta } from './useInviteTerapeuta'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useInviteTerapeuta', () => {
  let mockInvoke: jest.Mock

  beforeEach(() => {
    mockInvoke = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      functions: { invoke: mockInvoke },
    })
  })

  it('returns ok:true and no error when invoke succeeds with no data.error', async () => {
    mockInvoke.mockResolvedValue({ data: { terapeutaId: 't-99' }, error: null })
    const { result } = renderHook(() => useInviteTerapeuta())
    let returnValue: { ok: boolean; terapeutaId?: string } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        nombre: 'Ana',
        email: 'ana@clinic.com',
      })
    })
    expect(returnValue).toEqual({ ok: true, terapeutaId: 't-99' })
  })

  it('returns error:null after a successful invoke', async () => {
    mockInvoke.mockResolvedValue({ data: { terapeutaId: 't-99' }, error: null })
    const { result } = renderHook(() => useInviteTerapeuta())
    await act(async () => {
      await result.current.mutate({ nombre: 'Ana', email: 'ana@clinic.com' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('returns ok:false and surfaces data.error when invoke returns email_duplicado', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'email_duplicado' },
      error: null,
    })
    const { result } = renderHook(() => useInviteTerapeuta())
    let returnValue:
      | { ok: boolean; terapeutaId?: string; error?: string }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        nombre: 'Ana',
        email: 'ana@clinic.com',
      })
    })
    expect(returnValue).toEqual({ ok: false, error: 'email_duplicado' })
  })

  it('sets error to email_duplicado in hook state when data.error is email_duplicado', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'email_duplicado' },
      error: null,
    })
    const { result } = renderHook(() => useInviteTerapeuta())
    await act(async () => {
      await result.current.mutate({ nombre: 'Ana', email: 'ana@clinic.com' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'email_duplicado',
    })
  })

  it('returns ok:false when invokeError is present', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network_error' },
    })
    const { result } = renderHook(() => useInviteTerapeuta())
    let returnValue:
      | { ok: boolean; terapeutaId?: string; error?: string }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        nombre: 'Ana',
        email: 'ana@clinic.com',
      })
    })
    expect(returnValue).toEqual({ ok: false, error: 'network_error' })
  })

  it('sets error to invokeError.message when invoke returns an error object', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network_error' },
    })
    const { result } = renderHook(() => useInviteTerapeuta())
    await act(async () => {
      await result.current.mutate({ nombre: 'Ana', email: 'ana@clinic.com' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'network_error',
    })
  })

  it('extracts data.error from invokeError.context body when edge fn returns 4xx with json error code', async () => {
    // Simulates supabase-js FunctionsHttpError: data=null, error has context Response
    const contextResponse = {
      json: jest.fn().mockResolvedValue({ error: 'email_duplicado' }),
    }
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: contextResponse,
      },
    })
    const { result } = renderHook(() => useInviteTerapeuta())
    let returnValue:
      | { ok: boolean; terapeutaId?: string; error?: string }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        nombre: 'Ana',
        email: 'ana@clinic.com',
      })
    })
    expect(returnValue).toEqual({ ok: false, error: 'email_duplicado' })
    expect(result.current.error).toBe('email_duplicado')
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
    const { result } = renderHook(() => useInviteTerapeuta())
    await act(async () => {
      await result.current.mutate({ nombre: 'Ana', email: 'ana@clinic.com' })
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
    const { result } = renderHook(() => useInviteTerapeuta())
    await act(async () => {
      await result.current.mutate({ nombre: 'Ana', email: 'ana@clinic.com' })
    })
    expect(result.current.error).toBe(
      'Edge Function returned a non-2xx status code',
    )
  })

  it('sets isLoading to true during the invoke and false after', async () => {
    let resolveInvoke!: (value: unknown) => void
    mockInvoke.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoke = resolve
      }),
    )
    const { result } = renderHook(() => useInviteTerapeuta())

    act(() => {
      result.current.mutate({ nombre: 'Ana', email: 'ana@clinic.com' })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveInvoke({ data: { terapeutaId: 't-1' }, error: null })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
