import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useDeactivateTerapeuta } from './useDeactivateTerapeuta'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useDeactivateTerapeuta', () => {
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
    const { result } = renderHook(() => useDeactivateTerapeuta())
    let returnValue:
      | { ok: boolean; error?: string; errorCount?: number | null }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        motivo: 'Ya no trabaja aqui',
      })
    })
    expect(returnValue).toEqual({ ok: true })
  })

  it('returns error:null and errorCount:null after a successful mutate', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, terapeuta: null },
      error: null,
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({
        terapeutaId: 't-1',
        motivo: 'Ya no trabaja aqui',
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
      errorCount: null,
    })
  })

  it('returns ok:false with error and errorCount when data.error is tiene_pacientes_activos', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'tiene_pacientes_activos', count: 3 },
      error: null,
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    let returnValue:
      | { ok: boolean; error?: string; errorCount?: number | null }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        motivo: 'Motivo cualquiera',
      })
    })
    expect(returnValue).toEqual({
      ok: false,
      error: 'tiene_pacientes_activos',
      errorCount: 3,
    })
  })

  it('sets error to tiene_pacientes_activos and errorCount to the count from data', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'tiene_pacientes_activos', count: 3 },
      error: null,
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({
        terapeutaId: 't-1',
        motivo: 'Motivo cualquiera',
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'tiene_pacientes_activos',
      errorCount: 3,
    })
  })

  it('sets error to no_puede_autodesactivarse when data.error is that code', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'no_puede_autodesactivarse' },
      error: null,
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1', motivo: 'test' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_puede_autodesactivarse',
      errorCount: null,
    })
  })

  it('sets error to motivo_requerido when data.error is that code', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'motivo_requerido' },
      error: null,
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1', motivo: '' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'motivo_requerido',
      errorCount: null,
    })
  })

  it('sets error to deactivate_failed for unrecognised data.error codes', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'some_unknown_error' },
      error: null,
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1', motivo: 'test' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'deactivate_failed',
      errorCount: null,
    })
  })

  it('returns ok:false with error from invokeError.message when invoke errors without context', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'network_error' },
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    let returnValue:
      | { ok: boolean; error?: string; errorCount?: number | null }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        motivo: 'test',
      })
    })
    expect(returnValue).toEqual({ ok: false, error: 'network_error' })
  })

  it('extracts no_puede_autodesactivarse from FunctionsHttpError context.json() body', async () => {
    const contextResponse = {
      json: jest.fn().mockResolvedValue({ error: 'no_puede_autodesactivarse' }),
    }
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: contextResponse,
      },
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    let returnValue:
      | { ok: boolean; error?: string; errorCount?: number | null }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        motivo: 'test',
      })
    })
    expect(returnValue).toEqual({
      ok: false,
      error: 'no_puede_autodesactivarse',
    })
    expect(result.current.error).toBe('no_puede_autodesactivarse')
  })

  it('extracts tiene_pacientes_activos + count from FunctionsHttpError context.json() body', async () => {
    const contextResponse = {
      json: jest
        .fn()
        .mockResolvedValue({ error: 'tiene_pacientes_activos', count: 5 }),
    }
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        message: 'Edge Function returned a non-2xx status code',
        context: contextResponse,
      },
    })
    const { result } = renderHook(() => useDeactivateTerapeuta())
    let returnValue:
      | { ok: boolean; error?: string; errorCount?: number | null }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        terapeutaId: 't-1',
        motivo: 'test',
      })
    })
    expect(returnValue).toEqual({
      ok: false,
      error: 'tiene_pacientes_activos',
      errorCount: 5,
    })
    expect(result.current.error).toBe('tiene_pacientes_activos')
    expect(result.current.errorCount).toBe(5)
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
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1', motivo: 'test' })
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
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1', motivo: 'test' })
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
    const { result } = renderHook(() => useDeactivateTerapeuta())
    await act(async () => {
      await result.current.mutate({ terapeutaId: 't-1', motivo: 'test' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'network_error',
      errorCount: null,
    })
  })

  it('sets isLoading to true during invoke and false after', async () => {
    let resolveInvoke!: (value: unknown) => void
    mockInvoke.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoke = resolve
      }),
    )
    const { result } = renderHook(() => useDeactivateTerapeuta())

    act(() => {
      result.current.mutate({ terapeutaId: 't-1', motivo: 'test' })
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
