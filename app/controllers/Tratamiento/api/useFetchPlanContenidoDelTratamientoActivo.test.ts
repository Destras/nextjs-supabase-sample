import { renderHook, waitFor, act } from '@testing-library/react'
import type { Tratamiento } from '../TratamientoTypes'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'
import { fetchPlanContenidoDelTratamientoActivo } from './fetchPlanContenidoDelTratamientoActivo'
import { useFetchPlanContenidoDelTratamientoActivo } from './useFetchPlanContenidoDelTratamientoActivo'

jest.mock('./fetchPlanContenidoDelTratamientoActivo')

describe('useFetchPlanContenidoDelTratamientoActivo', () => {
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
      niveles: [],
      entregasSemanales: [
        {
          id: 'semana-1',
          numeroSemana: 1,
          fechaEntregada: null,
          fechaEntregaEsperada: null,
          contenido: [],
        },
      ],
    }
  })

  it('noops when pacienteId is null returning idle state', async () => {
    const { result } = renderHook(() =>
      useFetchPlanContenidoDelTratamientoActivo(null),
    )
    await waitFor(() => {
      expect(result.current).toEqual({
        tratamiento: null,
        semanasTotales: null,
        cantidadNiveles: null,
        frasesPorSemana: {},
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with tratamiento, semanasTotales, and isLoading false on success', async () => {
    ;(fetchPlanContenidoDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: tratamientoFixture,
      semanasTotales: 8,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: [] },
      error: null,
    })

    const { result } = renderHook(() =>
      useFetchPlanContenidoDelTratamientoActivo('p-1'),
    )

    await waitFor(() => {
      expect(result.current).toEqual({
        tratamiento: tratamientoFixture,
        semanasTotales: 8,
        cantidadNiveles: 4,
        frasesPorSemana: { 1: [] },
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with error and no tratamiento when fetch returns an error', async () => {
    ;(fetchPlanContenidoDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: null,
      semanasTotales: null,
      cantidadNiveles: null,
      frasesPorSemana: {},
      error: 'boom',
    })

    const { result } = renderHook(() =>
      useFetchPlanContenidoDelTratamientoActivo('p-1'),
    )

    await waitFor(() => {
      expect(result.current).toEqual({
        tratamiento: null,
        semanasTotales: null,
        cantidadNiveles: null,
        frasesPorSemana: {},
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('re-fetches when refresh is called', async () => {
    ;(fetchPlanContenidoDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: tratamientoFixture,
      semanasTotales: 8,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: [] },
      error: null,
    })

    const { result } = renderHook(() =>
      useFetchPlanContenidoDelTratamientoActivo('p-1'),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(
        (fetchPlanContenidoDelTratamientoActivo as jest.Mock).mock.calls.length,
      ).toBe(2)
    })
  })

  it('refresh no vuelve a mostrar la carga (BETA-046)', async () => {
    ;(fetchPlanContenidoDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: tratamientoFixture,
      semanasTotales: 8,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: [] },
      error: null,
    })
    const { result } = renderHook(() =>
      useFetchPlanContenidoDelTratamientoActivo('p-1'),
    )
    await act(async () => {})
    ;(fetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    )
    act(() => {
      result.current.refresh()
    })
    expect(result.current.isLoading).toBe(false)
  })

  it('cambiar de paciente sí vuelve a mostrar la carga', async () => {
    ;(fetchPlanContenidoDelTratamientoActivo as jest.Mock).mockResolvedValue({
      tratamiento: tratamientoFixture,
      semanasTotales: 8,
      cantidadNiveles: 4,
      frasesPorSemana: { 1: [] },
      error: null,
    })
    const { result, rerender } = renderHook(
      ({ id }) => useFetchPlanContenidoDelTratamientoActivo(id),
      { initialProps: { id: 'p-1' } },
    )
    await act(async () => {})
    ;(fetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    )
    rerender({ id: 'p-2' })
    expect(result.current.isLoading).toBe(true)
  })
})
