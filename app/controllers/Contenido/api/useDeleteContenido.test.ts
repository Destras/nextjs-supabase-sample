import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useDeleteContenido } from './useDeleteContenido'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useDeleteContenido', () => {
  let mockRpc: jest.Mock

  beforeEach(() => {
    mockRpc = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    })
  })

  it('returns ok:true when rpc succeeds', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useDeleteContenido())
    let returnValue: { ok: boolean } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ id: 'c-1' })
    })
    expect(returnValue).toEqual({ ok: true })
  })

  it('returns ok:false with error code in the resolved object on en_uso', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'en_uso', code: 'P0001' },
    })
    const { result } = renderHook(() => useDeleteContenido())
    let returnValue: { ok: boolean; error?: string } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ id: 'c-1' })
    })
    expect(returnValue).toEqual({ ok: false, error: 'en_uso' })
  })

  it('returns ok:false with error code in the resolved object on no_encontrado', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_encontrado', code: 'P0002' },
    })
    const { result } = renderHook(() => useDeleteContenido())
    let returnValue: { ok: boolean; error?: string } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ id: 'c-1' })
    })
    expect(returnValue).toEqual({ ok: false, error: 'no_encontrado' })
  })

  it('returns ok:false with normalised code in the resolved object for unknown errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useDeleteContenido())
    let returnValue: { ok: boolean; error?: string } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ id: 'c-1' })
    })
    expect(returnValue).toEqual({
      ok: false,
      error: 'delete_contenido_failed',
    })
  })

  it('returns error:null in hook state after a successful mutate', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useDeleteContenido())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('sets error to en_uso in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'en_uso', code: 'P0001' },
    })
    const { result } = renderHook(() => useDeleteContenido())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'en_uso',
    })
  })

  it('sets error to no_encontrado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_encontrado', code: 'P0002' },
    })
    const { result } = renderHook(() => useDeleteContenido())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_encontrado',
    })
  })

  it('sets error to no_autorizado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: '42501' },
    })
    const { result } = renderHook(() => useDeleteContenido())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_autorizado',
    })
  })

  it('sets error to delete_contenido_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useDeleteContenido())
    await act(async () => {
      await result.current.mutate({ id: 'c-1' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'delete_contenido_failed',
    })
  })

  it('sets isLoading to true during rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useDeleteContenido())

    act(() => {
      result.current.mutate({ id: 'c-1' })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveRpc({ data: null, error: null })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
