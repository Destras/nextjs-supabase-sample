import { renderHook, waitFor, act } from '@testing-library/react'
import type { Tratamiento } from '../TratamientoTypes'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'
import { fetchEvaluacionesDelTratamientoActivo } from './fetchEvaluacionesDelTratamientoActivo'
import { useFetchEvaluacionesDelTratamientoActivo } from './useFetchEvaluacionesDelTratamientoActivo'

jest.mock('./fetchEvaluacionesDelTratamientoActivo')

describe('useFetchEvaluacionesDelTratamientoActivo', () => {
  let tratamientoFixture: Tratamiento

  beforeEach(() => {
    tratamientoFixture = {
      id: 'etapa-1',
      fechaInicio: '2025-01-01',
      fechaFin: null,
      estado: TRATAMIENTO_STATE.ACTIVO,
      diagnostico: {
        causa: {
          id: 'c-1',
          codigo: 'C',
          nombre: 'N',
          definicion: '',
          emocionesEsperadas: [],
          activo: true,
          etapas: [],
        },
        algoritmo: {
          id: 'a-1',
          codigo: 'A',
          nombre: 'AN',
          definicion: '',
          comportamiento: '',
          comportamientoBadge: '',
          activo: true,
          etapas: [],
        },
        bloqueos: [],
      },
      niveles: [
        {
          id: 'n-1',
          numeroNivel: 1,
          fechaSeguimientoEsperado: '2025-02-01',
          fechaSeguimientoReal: null,
          observaciones: null,
          evaluacion: { id: 'ev-1', score: 4, fechaRespuesta: '2025-02-01' },
        },
      ],
      entregasSemanales: [],
    }
  })

  it('noops when pacienteId is null returning idle state', async () => {
    const { result } = renderHook(() =>
      useFetchEvaluacionesDelTratamientoActivo(null),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        tratamiento: null,
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with tratamiento and isLoading false on success', async () => {
    ;(fetchEvaluacionesDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: tratamientoFixture,
      error: null,
    })

    const { result } = renderHook(() =>
      useFetchEvaluacionesDelTratamientoActivo('p-1'),
    )

    await waitFor(() => {
      expect(result.current).toEqual({
        tratamiento: tratamientoFixture,
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with error and no tratamiento when fetch fails', async () => {
    ;(fetchEvaluacionesDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: null,
      error: 'boom',
    })

    const { result } = renderHook(() =>
      useFetchEvaluacionesDelTratamientoActivo('p-1'),
    )

    await waitFor(() => {
      expect(result.current).toEqual({
        tratamiento: null,
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('sets error and isLoading false when the fetcher promise rejects', async () => {
    ;(fetchEvaluacionesDelTratamientoActivo as jest.Mock).mockRejectedValue(
      new Error('network fail'),
    )

    const { result } = renderHook(() =>
      useFetchEvaluacionesDelTratamientoActivo('p-1'),
    )

    await waitFor(() => {
      expect(result.current).toEqual({
        tratamiento: null,
        isLoading: false,
        error: 'network fail',
        refresh: expect.any(Function),
      })
    })
  })

  it('re-fetches when refresh is called', async () => {
    ;(fetchEvaluacionesDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: tratamientoFixture,
      error: null,
    })

    const { result } = renderHook(() =>
      useFetchEvaluacionesDelTratamientoActivo('p-1'),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(
        (fetchEvaluacionesDelTratamientoActivo as jest.Mock).mock.calls.length,
      ).toBe(2)
    })
  })
})
