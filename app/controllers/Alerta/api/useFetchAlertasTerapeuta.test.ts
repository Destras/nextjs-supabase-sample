import { renderHook, waitFor, act } from '@testing-library/react'
import type { Alerta } from '../AlertaTypes'
import { ALERTA_TIPO } from '../AlertaTypes'
import { fetchAlertasTerapeuta } from './fetchAlertasTerapeuta'
import { useFetchTiposAlerta } from './useFetchTiposAlerta'
import { useFetchAlertasTerapeuta } from './useFetchAlertasTerapeuta'

jest.mock('./fetchAlertasTerapeuta')
jest.mock('./useFetchTiposAlerta', () => ({
  useFetchTiposAlerta: jest.fn(),
}))

describe('useFetchAlertasTerapeuta', () => {
  let alertaFixture: Alerta

  beforeEach(() => {
    alertaFixture = {
      tipo: ALERTA_TIPO.SCORE_BAJO,
      prioridad: 'alta',
      pacienteId: 'p-1',
      pacienteNombre: 'Juan',
      terapeutaId: 't-1',
      terapeutaNombre: null,
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

  it('stays in isLoading while the tipos catalog is still loading', () => {
    ;(useFetchTiposAlerta as jest.Mock).mockReturnValue({
      tipos: [],
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useFetchAlertasTerapeuta())
    expect(result.current.isLoading).toBe(true)
  })

  it('does not call fetchAlertasTerapeuta while the tipos catalog is loading', () => {
    ;(useFetchTiposAlerta as jest.Mock).mockReturnValue({
      tipos: [],
      isLoading: true,
      error: null,
    })
    renderHook(() => useFetchAlertasTerapeuta())
    expect(fetchAlertasTerapeuta).not.toHaveBeenCalled()
  })

  it('returns the fetched alertas once the catalog and the alertas resolve', async () => {
    ;(fetchAlertasTerapeuta as jest.Mock).mockResolvedValue({
      data: [alertaFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchAlertasTerapeuta())
    await waitFor(() => {
      expect(result.current).toEqual({
        alertas: [alertaFixture],
        tipos: [],
        isLoading: false,
        error: null,
        refetch: expect.any(Function),
      })
    })
  })

  it('exposes the tipos catalog it already fetched internally, so callers do not need a second useFetchTiposAlerta() call', async () => {
    const tipoFixture = {
      codigo: 'score_bajo',
      nombre: 'Score bajo',
      prioridad: 'alta' as const,
      orden: 1,
      icono: '↘',
      descripcion: null,
      activo: true,
    }
    ;(useFetchTiposAlerta as jest.Mock).mockReturnValue({
      tipos: [tipoFixture],
      isLoading: false,
      error: null,
    })
    ;(fetchAlertasTerapeuta as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    })
    const { result } = renderHook(() => useFetchAlertasTerapeuta())
    await waitFor(() => {
      expect(result.current.tipos).toEqual([tipoFixture])
    })
  })

  it('surfaces the tipos catalog error without calling fetchAlertasTerapeuta', async () => {
    ;(useFetchTiposAlerta as jest.Mock).mockReturnValue({
      tipos: [],
      isLoading: false,
      error: 'boom_tipos',
    })
    const { result } = renderHook(() => useFetchAlertasTerapeuta())
    await waitFor(() => {
      expect(result.current).toEqual({
        alertas: [],
        tipos: [],
        isLoading: false,
        error: 'boom_tipos',
        refetch: expect.any(Function),
      })
    })
  })

  it('surfaces the alertas fetch error when it fails', async () => {
    ;(fetchAlertasTerapeuta as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom_alertas'),
    })
    const { result } = renderHook(() => useFetchAlertasTerapeuta())
    await waitFor(() => {
      expect(result.current.error).toBe('boom_alertas')
    })
  })

  it('calls fetchAlertasTerapeuta a second time when refetch is invoked', async () => {
    ;(fetchAlertasTerapeuta as jest.Mock).mockResolvedValue({
      data: [alertaFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchAlertasTerapeuta())
    await waitFor(() => {
      expect(fetchAlertasTerapeuta).toHaveBeenCalledTimes(1)
    })

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(fetchAlertasTerapeuta).toHaveBeenCalledTimes(2)
    })
  })
})
