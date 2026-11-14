import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import { useCreateContenido } from './useCreateContenido'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useCreateContenido', () => {
  let mockRpc: jest.Mock

  beforeEach(() => {
    mockRpc = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({
      rpc: mockRpc,
    })
  })

  it('returns ok:true and the mapped contenido when rpc succeeds', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'c-1',
          tipo: 'video',
          titulo: 'Mi video',
          descripcion: 'Desc',
          recurso_ref: 'https://example.com/v.mp4',
          duracion_seg: 120,
        },
      ],
      error: null,
    })
    const { result } = renderHook(() => useCreateContenido())
    let returnValue:
      | {
          ok: boolean
          contenido?: import('../ContenidoTypes').Contenido
        }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'Mi video',
        descripcion: 'Desc',
        recursoRef: 'https://example.com/v.mp4',
        duracionSeg: 120,
      })
    })
    expect(returnValue).toEqual({
      ok: true,
      contenido: {
        id: 'c-1',
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'Mi video',
        descripcion: 'Desc',
        imagenes: [],
        contenido: {
          recursoRef: 'https://example.com/v.mp4',
          duracion: 120,
        },
      },
    })
  })

  it('returns error:null in hook state after a successful mutate', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'c-1',
          tipo: 'audio',
          titulo: 'Mi audio',
          descripcion: null,
          recurso_ref: null,
          duracion_seg: null,
        },
      ],
      error: null,
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.AUDIO,
        titulo: 'Mi audio',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: null,
    })
  })

  it('returns ok:false when rpc returns no_autorizado', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenido())
    let returnValue:
      | { ok: boolean; contenido?: import('../ContenidoTypes').Contenido }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'T',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })
    expect(returnValue).toEqual({ ok: false })
  })

  it('sets error to no_autorizado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_autorizado', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'T',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_autorizado',
    })
  })

  it('sets error to tipo_invalido in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'tipo_invalido', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'T',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'tipo_invalido',
    })
  })

  it('sets error to titulo_vacio in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'titulo_vacio', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: '',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'titulo_vacio',
    })
  })

  it('sets error to create_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'T',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'create_failed',
    })
  })

  it('sets isLoading to true during rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useCreateContenido())

    act(() => {
      result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'T',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true)
    })

    await act(async () => {
      resolveRpc({
        data: [
          {
            id: 'c-1',
            tipo: 'video',
            titulo: 'T',
            descripcion: null,
            recurso_ref: null,
            duracion_seg: null,
          },
        ],
        error: null,
      })
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('passes p_recurso_ref and p_duracion_seg to the rpc', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'c-2',
          tipo: 'video',
          titulo: 'T',
          descripcion: null,
          recurso_ref: 'https://example.com/v.mp4',
          duracion_seg: 90,
        },
      ],
      error: null,
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'T',
        descripcion: null,
        recursoRef: 'https://example.com/v.mp4',
        duracionSeg: 90,
      })
    })
    expect(mockRpc).toHaveBeenCalledWith('create_contenido', {
      p_tipo: 'video',
      p_titulo: 'T',
      p_descripcion: null,
      p_recurso_ref: 'https://example.com/v.mp4',
      p_duracion_seg: 90,
    })
  })

  it('passes p_tipo egregor to the rpc when tipo is EGREGOR (design §8.2, reuses the video pipeline)', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'c-3',
          tipo: 'egregor',
          titulo: 'T',
          descripcion: null,
          recurso_ref: 'https://example.com/e.mp4',
          duracion_seg: 60,
        },
      ],
      error: null,
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.EGREGOR,
        titulo: 'T',
        descripcion: null,
        recursoRef: 'https://example.com/e.mp4',
        duracionSeg: 60,
      })
    })
    expect(mockRpc).toHaveBeenCalledWith('create_contenido', {
      p_tipo: 'egregor',
      p_titulo: 'T',
      p_descripcion: null,
      p_recurso_ref: 'https://example.com/e.mp4',
      p_duracion_seg: 60,
    })
  })

  it('sets error to recurso_ref_vacio for recurso_ref_vacio rpc error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'recurso_ref_vacio', code: 'P0001' },
    })
    const { result } = renderHook(() => useCreateContenido())
    await act(async () => {
      await result.current.mutate({
        tipo: TIPO_CONTENIDO.VIDEO,
        titulo: 'T',
        descripcion: null,
        recursoRef: '',
        duracionSeg: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'recurso_ref_vacio',
    })
  })
})
