import { renderHook, waitFor } from '@testing-library/react'
import type { Alerta } from '../AlertaTypes'
import { ALERTA_TIPO } from '../AlertaTypes'
import { fetchAlertasByTerapeuta } from './fetchAlertasByTerapeuta'
import { useFetchTiposAlerta } from './useFetchTiposAlerta'
import { useFetchAlertasByTerapeuta } from './useFetchAlertasByTerapeuta'

jest.mock('./fetchAlertasByTerapeuta')
jest.mock('./useFetchTiposAlerta', () => ({
  useFetchTiposAlerta: jest.fn(),
}))

describe('useFetchAlertasByTerapeuta', () => {
  let alertaFixture: Alerta

  beforeEach(() => {
    alertaFixture = {
      tipo: ALERTA_TIPO.SCORE_BAJO,
      prioridad: 'alta',
      pacienteId: 'p-1',
      pacienteNombre: 'Juan',
      terapeutaId: 't-1',
      terapeutaNombre: 'Ana',
      nombre: 'Score bajo',
      icono: '↘',
      mensaje: 'score 2 · última evaluación',
      eventoRef: 'nivel-1',
      fecha: '2026-07-01',
      descartable: true,
    }
    ;(useFetchTiposAlerta as jest.Mock).mockReturnValue({
      tipos: [],
      isLoading: false,
      error: null,
    })
  })

  it('stays idle with an empty list and does not fetch when terapeutaId is null', async () => {
    const { result } = renderHook(() => useFetchAlertasByTerapeuta(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        alertas: [],
        isLoading: false,
        error: null,
      })
    })
    expect(fetchAlertasByTerapeuta).not.toHaveBeenCalled()
  })

  it('stays in isLoading while the tipos catalog is still loading', () => {
    ;(useFetchTiposAlerta as jest.Mock).mockReturnValue({
      tipos: [],
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useFetchAlertasByTerapeuta('t-1'))
    expect(result.current.isLoading).toBe(true)
  })

  it('returns the fetched alertas once the catalog and the alertas resolve', async () => {
    ;(fetchAlertasByTerapeuta as jest.Mock).mockResolvedValue({
      data: [alertaFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchAlertasByTerapeuta('t-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        alertas: [alertaFixture],
        isLoading: false,
        error: null,
      })
    })
    expect(fetchAlertasByTerapeuta).toHaveBeenCalledWith('t-1', [])
  })

  it('surfaces the tipos catalog error without calling fetchAlertasByTerapeuta', async () => {
    ;(useFetchTiposAlerta as jest.Mock).mockReturnValue({
      tipos: [],
      isLoading: false,
      error: 'boom_tipos',
    })
    const { result } = renderHook(() => useFetchAlertasByTerapeuta('t-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        alertas: [],
        isLoading: false,
        error: 'boom_tipos',
      })
    })
    expect(fetchAlertasByTerapeuta).not.toHaveBeenCalled()
  })

  it('surfaces the alertas fetch error when it fails', async () => {
    ;(fetchAlertasByTerapeuta as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom_alertas'),
    })
    const { result } = renderHook(() => useFetchAlertasByTerapeuta('t-1'))
    await waitFor(() => {
      expect(result.current.error).toBe('boom_alertas')
    })
  })

  it('re-fetches when terapeutaId changes to a different id', async () => {
    ;(fetchAlertasByTerapeuta as jest.Mock).mockResolvedValue({
      data: [alertaFixture],
      error: null,
    })
    const { rerender } = renderHook(
      ({ terapeutaId }) => useFetchAlertasByTerapeuta(terapeutaId),
      { initialProps: { terapeutaId: 't-1' } },
    )
    await waitFor(() => {
      expect(fetchAlertasByTerapeuta).toHaveBeenCalledTimes(1)
    })

    rerender({ terapeutaId: 't-2' })

    await waitFor(() => {
      expect(fetchAlertasByTerapeuta).toHaveBeenCalledTimes(2)
    })
    expect(fetchAlertasByTerapeuta).toHaveBeenLastCalledWith('t-2', [])
  })
})
