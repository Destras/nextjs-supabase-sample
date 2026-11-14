import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useReplaceAndDeleteContenido } from './useReplaceAndDeleteContenido'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useReplaceAndDeleteContenido', () => {
  let mockRpc: jest.Mock

  beforeEach(() => {
    mockRpc = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    })
  })

  it('returns ok:true and affected count when rpc succeeds', async () => {
    mockRpc.mockResolvedValue({ data: [{ affected: 5 }], error: null })
    const { result } = renderHook(() => useReplaceAndDeleteContenido())
    let returnValue: { ok: boolean; affected?: number } | undefined
    await act(async () => {
      returnValue = await result.current.mutate({ oldId: 'c-1', newId: 'c-2' })
    })
    expect(returnValue).toEqual({ ok: true, affected: 5 })
  })

  it('returns error:null in hook state after a successful mutate', async () => {
    mockRpc.mockResolvedValue({ data: [{ affected: 2 }], error: null })
    const { result } = renderHook(() => useReplaceAndDeleteContenido())
    await act(async () => {
      await result.current.mutate({ oldId: 'c-1', newId: 'c-2' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('sets error to tipo_distinto in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'tipo_distinto', code: 'P0003' },
    })
    const { result } = renderHook(() => useReplaceAndDeleteContenido())
    await act(async () => {
      await result.current.mutate({ oldId: 'c-1', newId: 'c-2' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'tipo_distinto',
    })
  })

  it('sets error to no_encontrado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_encontrado', code: 'P0002' },
    })
    const { result } = renderHook(() => useReplaceAndDeleteContenido())
    await act(async () => {
      await result.current.mutate({ oldId: 'c-1', newId: 'c-2' })
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
    const { result } = renderHook(() => useReplaceAndDeleteContenido())
    await act(async () => {
      await result.current.mutate({ oldId: 'c-1', newId: 'c-2' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_autorizado',
    })
  })

  it('sets error to replace_contenido_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useReplaceAndDeleteContenido())
    await act(async () => {
      await result.current.mutate({ oldId: 'c-1', newId: 'c-2' })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'replace_contenido_failed',
    })
  })

  it('sets isLoading to true during rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useReplaceAndDeleteContenido())

    act(() => {
      result.current.mutate({ oldId: 'c-1', newId: 'c-2' })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveRpc({ data: [{ affected: 1 }], error: null })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
