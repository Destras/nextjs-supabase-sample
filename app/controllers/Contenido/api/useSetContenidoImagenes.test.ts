import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { useSetContenidoImagenes } from './useSetContenidoImagenes'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useSetContenidoImagenes', () => {
  let mockRpc: jest.Mock

  beforeEach(() => {
    mockRpc = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    })
  })

  it('calls set_contenido_imagenes with p_contenido_id and p_paths', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    const { result } = renderHook(() => useSetContenidoImagenes())
    await act(async () => {
      await result.current.mutate({
        contenidoId: 'c-1',
        paths: ['cma/a.jpg', 'cma/c.jpg'],
      })
    })
    expect(mockRpc).toHaveBeenCalledWith('set_contenido_imagenes', {
      p_contenido_id: 'c-1',
      p_paths: ['cma/a.jpg', 'cma/c.jpg'],
    })
  })

  it('returns ok:true with removedPaths from removed_path rows', async () => {
    mockRpc.mockResolvedValue({
      data: [{ removed_path: 'cma/b.jpg' }, { removed_path: 'cma/d.jpg' }],
      error: null,
    })
    const { result } = renderHook(() => useSetContenidoImagenes())
    let returnValue: Awaited<ReturnType<typeof result.current.mutate>>
    await act(async () => {
      returnValue = await result.current.mutate({
        contenidoId: 'c-1',
        paths: ['cma/a.jpg'],
      })
    })
    expect(returnValue!).toEqual({
      ok: true,
      removedPaths: ['cma/b.jpg', 'cma/d.jpg'],
    })
  })

  it('returns ok:true with an empty removedPaths when nothing was removed', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })
    const { result } = renderHook(() => useSetContenidoImagenes())
    let returnValue: Awaited<ReturnType<typeof result.current.mutate>>
    await act(async () => {
      returnValue = await result.current.mutate({
        contenidoId: 'c-1',
        paths: ['cma/a.jpg'],
      })
    })
    expect(returnValue!).toEqual({ ok: true, removedPaths: [] })
  })

  it('sets error to galeria_vacia in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'galeria_vacia', code: 'P0001' },
    })
    const { result } = renderHook(() => useSetContenidoImagenes())
    await act(async () => {
      await result.current.mutate({ contenidoId: 'c-1', paths: [] })
    })
    expect(result.current.error).toBe('galeria_vacia')
  })

  it('sets error to no_encontrado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_encontrado', code: 'P0002' },
    })
    const { result } = renderHook(() => useSetContenidoImagenes())
    await act(async () => {
      await result.current.mutate({
        contenidoId: 'missing',
        paths: ['cma/a.jpg'],
      })
    })
    expect(result.current.error).toBe('no_encontrado')
  })

  it('sets error to no_autorizado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: 'P0001' },
    })
    const { result } = renderHook(() => useSetContenidoImagenes())
    await act(async () => {
      await result.current.mutate({
        contenidoId: 'c-1',
        paths: ['cma/a.jpg'],
      })
    })
    expect(result.current.error).toBe('no_autorizado')
  })

  it('sets error to set_imagenes_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useSetContenidoImagenes())
    await act(async () => {
      await result.current.mutate({
        contenidoId: 'c-1',
        paths: ['cma/a.jpg'],
      })
    })
    expect(result.current.error).toBe('set_imagenes_failed')
  })

  it('returns ok:false and an empty removedPaths when rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: 'P0001' },
    })
    const { result } = renderHook(() => useSetContenidoImagenes())
    let returnValue: Awaited<ReturnType<typeof result.current.mutate>>
    await act(async () => {
      returnValue = await result.current.mutate({
        contenidoId: 'c-1',
        paths: ['cma/a.jpg'],
      })
    })
    expect(returnValue!).toEqual({ ok: false, removedPaths: [] })
  })

  it('sets isLoading to true during the rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useSetContenidoImagenes())

    act(() => {
      result.current.mutate({ contenidoId: 'c-1', paths: ['cma/a.jpg'] })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveRpc({ data: [], error: null })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
