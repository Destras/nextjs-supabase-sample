import { renderHook, waitFor } from '@testing-library/react'
import type { Tratamiento } from '../TratamientoTypes'
import { TRATAMIENTO_STATE } from '../TratamientoTypes'
import { fetchTratamientosByPaciente } from './fetchTratamientosByPaciente'
import { useFetchTratamientosByPaciente } from './useFetchTratamientosByPaciente'

jest.mock('./fetchTratamientosByPaciente')

describe('useFetchTratamientosByPaciente', () => {
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
      entregasSemanales: [],
    }
  })

  it('stays idle with empty list when pacienteId is null', async () => {
    const { result } = renderHook(() => useFetchTratamientosByPaciente(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        tratamientos: [],
        isLoading: false,
        error: null,
      })
    })
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchTratamientosByPaciente as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchTratamientosByPaciente('p-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        tratamientos: [],
        isLoading: false,
        error: 'boom',
      })
    })
  })

  it('returns the fetched tratamientos when the fetch succeeds', async () => {
    ;(fetchTratamientosByPaciente as jest.Mock).mockResolvedValue({
      data: [tratamientoFixture],
      error: null,
    })
    const { result } = renderHook(() => useFetchTratamientosByPaciente('p-1'))
    await waitFor(() => {
      expect(result.current).toEqual({
        tratamientos: [tratamientoFixture],
        isLoading: false,
        error: null,
      })
    })
  })
})
