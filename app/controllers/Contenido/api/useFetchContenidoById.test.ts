import { renderHook, waitFor } from '@testing-library/react'
import type { Contenido } from '../ContenidoTypes'
import { TIPO_CONTENIDO } from '../ContenidoTypes'
import { fetchContenidoById } from './fetchContenidoById'
import { useFetchContenidoById } from './useFetchContenidoById'

jest.mock('./fetchContenidoById')

describe('useFetchContenidoById', () => {
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

  it('stays idle with null contenido when contenidoId is null', async () => {
    const { result } = renderHook(() => useFetchContenidoById(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        contenido: null,
        isLoading: false,
        error: null,
      })
    })
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchContenidoById as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchContenidoById('c-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        contenido: null,
        isLoading: false,
        error: 'boom',
      })
    })
  })

  it('returns the fetched contenido when the fetch succeeds', async () => {
    ;(fetchContenidoById as jest.Mock).mockResolvedValue({
      data: fixture,
      error: null,
    })
    const { result } = renderHook(() => useFetchContenidoById('c-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        contenido: fixture,
        isLoading: false,
        error: null,
      })
    })
  })
})
