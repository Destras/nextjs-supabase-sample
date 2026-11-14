import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import { useCreateContenidoGaleria } from './useCreateContenidoGaleria'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useCreateContenidoGaleria', () => {
  let mockRpc: jest.Mock

  beforeEach(() => {
    mockRpc = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    })
  })

  it('calls create_contenido_galeria with p_tipo, p_titulo, p_descripcion, p_paths', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'c-1', tipo: 'cma', titulo: 'Galería', descripcion: null }],
      error: null,
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: ['cma/a.jpg', 'cma/b.jpg'],
      })
    })
    expect(mockRpc).toHaveBeenCalledWith('create_contenido_galeria', {
      p_tipo: 'cma',
      p_titulo: 'Galería',
      p_descripcion: null,
      p_paths: ['cma/a.jpg', 'cma/b.jpg'],
    })
  })

  it('returns ok:true with a Contenido whose imagenes reflect p_paths order', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'c-1', tipo: 'cma', titulo: 'Galería', descripcion: null }],
      error: null,
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    let returnValue: Awaited<ReturnType<typeof result.current.mutate>>
    await act(async () => {
      returnValue = await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: ['cma/a.jpg', 'cma/b.jpg'],
      })
    })
    expect(returnValue!).toEqual({
      ok: true,
      contenido: {
        id: 'c-1',
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        contenido: { recursoRef: null, duracion: null },
        imagenes: [
          { path: 'cma/a.jpg', orden: 1 },
          { path: 'cma/b.jpg', orden: 2 },
        ],
      },
    })
  })

  it('sets error to tipo_invalido in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'tipo_invalido', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: ['cma/a.jpg'],
      })
    })
    expect(result.current.error).toBe('tipo_invalido')
  })

  it('sets error to titulo_vacio in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'titulo_vacio', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: '',
        descripcion: null,
        paths: ['cma/a.jpg'],
      })
    })
    expect(result.current.error).toBe('titulo_vacio')
  })

  it('sets error to galeria_vacia in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'galeria_vacia', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: [],
      })
    })
    expect(result.current.error).toBe('galeria_vacia')
  })

  it('sets error to no_autorizado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: ['cma/a.jpg'],
      })
    })
    expect(result.current.error).toBe('no_autorizado')
  })

  it('sets error to create_galeria_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: ['cma/a.jpg'],
      })
    })
    expect(result.current.error).toBe('create_galeria_failed')
  })

  it('returns ok:false when rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenidoGaleria())
    let returnValue: Awaited<ReturnType<typeof result.current.mutate>>
    await act(async () => {
      returnValue = await result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: ['cma/a.jpg'],
      })
    })
    expect(returnValue!).toEqual({ ok: false })
  })

  it('sets isLoading to true during the rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useCreateContenidoGaleria())

    act(() => {
      result.current.mutate({
        tipo: TIPO_CONTENIDO.CMA,
        titulo: 'Galería',
        descripcion: null,
        paths: ['cma/a.jpg'],
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveRpc({
        data: [
          { id: 'c-1', tipo: 'cma', titulo: 'Galería', descripcion: null },
        ],
        error: null,
      })
    })

    expect(result.current.isLoading).toBe(false)
  })
})
