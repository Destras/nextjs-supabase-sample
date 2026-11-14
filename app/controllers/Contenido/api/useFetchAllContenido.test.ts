import { renderHook, waitFor, act } from '@testing-library/react'
import type { Contenido } from '../ContenidoTypes'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import { fetchAllContenido } from './fetchAllContenido'
import { useFetchAllContenido } from './useFetchAllContenido'

jest.mock('./fetchAllContenido')

describe('useFetchAllContenido', () => {
  let fixture: Contenido

  beforeEach(() => {
    fixture = {
      id: 'c-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'V',
      descripcion: null,
      contenido: { recursoRef: null, duracion: null },
      imagenes: [],
    }
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchAllContenido as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchAllContenido())
    await waitFor(() => {
      expect(result.current).toEqual({
        contenidos: [],
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('returns the fetched contenidos when the fetch succeeds', async () => {
    ;(fetchAllContenido as jest.Mock).mockResolvedValue({
      data: [fixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchAllContenido())
    await waitFor(() => {
      expect(result.current).toEqual({
        contenidos: [fixture],
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('calling refresh() re-invokes the fetcher', async () => {
    ;(fetchAllContenido as jest.Mock).mockResolvedValue({
      data: [fixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchAllContenido())
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    await act(async () => {
      await result.current.refresh()
    })
    expect(fetchAllContenido as jest.Mock).toHaveBeenCalledTimes(2)
  })
})
