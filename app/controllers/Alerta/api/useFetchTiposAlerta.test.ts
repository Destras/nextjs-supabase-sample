import { renderHook, waitFor } from '@testing-library/react'
import type { TipoAlerta } from '../AlertaTypes'
import { fetchTiposAlerta } from './fetchTiposAlerta'
import { useFetchTiposAlerta } from './useFetchTiposAlerta'

jest.mock('./fetchTiposAlerta')

describe('useFetchTiposAlerta', () => {
  let tipoFixture: TipoAlerta

  beforeEach(() => {
    tipoFixture = {
      codigo: 'score_bajo',
      nombre: 'Score bajo',
      prioridad: 'alta',
      orden: 1,
      icono: '↘',
      descripcion: null,
      activo: true,
      descartable: true,
    }
  })

  it('returns the fetched tipos when the fetch succeeds', async () => {
    ;(fetchTiposAlerta as jest.Mock).mockResolvedValue({
      data: [tipoFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchTiposAlerta())
    await waitFor(() => {
      expect(result.current).toEqual({
        tipos: [tipoFixture],
        isLoading: false,
        error: null,
      })
    })
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchTiposAlerta as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchTiposAlerta())
    await waitFor(() => {
      expect(result.current).toEqual({
        tipos: [],
        isLoading: false,
        error: 'boom',
      })
    })
  })

  it('starts with isLoading true before the fetch resolves', () => {
    ;(fetchTiposAlerta as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useFetchTiposAlerta())
    expect(result.current.isLoading).toBe(true)
  })
})
