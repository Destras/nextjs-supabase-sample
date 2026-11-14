import { renderHook, act, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import { useUpdateContenido } from './useUpdateContenido'

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}))

describe('useUpdateContenido', () => {
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
          tipo: 'audio',
          titulo: 'Updated',
          descripcion: 'New desc',
          recurso_ref: 'https://example.com/a.mp3',
          duracion_seg: 60,
        },
      ],
      error: null,
    })
    const { result } = renderHook(() => useUpdateContenido())
    let returnValue:
      | {
          ok: boolean
          contenido?: import('../ContenidoTypes').Contenido
        }
      | undefined
    await act(async () => {
      returnValue = await result.current.mutate({
        id: 'c-1',
        titulo: 'Updated',
        descripcion: 'New desc',
      })
    })
    expect(returnValue).toEqual({
      ok: true,
      contenido: {
        id: 'c-1',
        tipo: TIPO_CONTENIDO.AUDIO,
        titulo: 'Updated',
        descripcion: 'New desc',
        contenido: {
          recursoRef: 'https://example.com/a.mp3',
          duracion: 60,
        },
        imagenes: [],
      },
    })
  })

  it('returns error:null in hook state after a successful mutate', async () => {
    mockRpc.mockResolvedValue({
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
    const { result } = renderHook(() => useUpdateContenido())
    await act(async () => {
      await result.current.mutate({
        id: 'c-1',
        titulo: 'T',
        descripcion: null,
      })
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
      error: { message: 'no_autorizado', code: 'P0001' },
    })
    const { result } = renderHook(() => useUpdateContenido())
    await act(async () => {
      await result.current.mutate({
        id: 'c-1',
        titulo: 'T',
        descripcion: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_autorizado',
    })
  })

  it('sets error to titulo_vacio in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'titulo_vacio', code: 'P0001' },
    })
    const { result } = renderHook(() => useUpdateContenido())
    await act(async () => {
      await result.current.mutate({
        id: 'c-1',
        titulo: '',
        descripcion: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'titulo_vacio',
    })
  })

  it('sets error to no_encontrado in hook state', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'no_encontrado', code: 'P0001' },
    })
    const { result } = renderHook(() => useUpdateContenido())
    await act(async () => {
      await result.current.mutate({
        id: 'nonexistent',
        titulo: 'T',
        descripcion: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'no_encontrado',
    })
  })

  it('sets error to update_failed for unrecognised rpc errors', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'unexpected_error', code: 'XXXXX' },
    })
    const { result } = renderHook(() => useUpdateContenido())
    await act(async () => {
      await result.current.mutate({
        id: 'c-1',
        titulo: 'T',
        descripcion: null,
      })
    })
    expect(result.current).toEqual({
      mutate: expect.any(Function),
      isLoading: false,
      error: 'update_failed',
    })
  })

  it('sets isLoading to true during rpc call and false after', async () => {
    let resolveRpc!: (value: unknown) => void
    mockRpc.mockReturnValue(
      new Promise((resolve) => {
        resolveRpc = resolve
      }),
    )
    const { result } = renderHook(() => useUpdateContenido())

    act(() => {
      result.current.mutate({ id: 'c-1', titulo: 'T', descripcion: null })
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
})
