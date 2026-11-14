import { renderHook, waitFor } from '@testing-library/react'
import type { AllDiagnosticos } from '../DiagnosticoTypes'
import { fetchAllDiagnosticos } from './fetchAllDiagnosticos'
import { useFetchAllDiagnosticos } from './useFetchAllDiagnosticos'

jest.mock('./fetchAllDiagnosticos')

describe('useFetchAllDiagnosticos', () => {
  let fixture: AllDiagnosticos

  beforeEach(() => {
    fixture = {
      causa: [],
      algoritmo: [],
      bloqueos: [],
      modalidades: [],
      alfabetos: [],
    }
  })

  it('returns the error message when the fetch fails', async () => {
    ;(fetchAllDiagnosticos as jest.Mock).mockResolvedValue({
      data: null,
      error: new Error('boom'),
    })
    const { result } = renderHook(() => useFetchAllDiagnosticos())
    await waitFor(() => {
      expect(result.current).toEqual({
        diagnosticos: null,
        isLoading: false,
        error: 'boom',
      })
    })
  })

  it('returns the fetched diagnosticos when the fetch succeeds', async () => {
    ;(fetchAllDiagnosticos as jest.Mock).mockResolvedValue({
      data: fixture,
      error: null,
    })
    const { result } = renderHook(() => useFetchAllDiagnosticos())
    await waitFor(() => {
      expect(result.current).toEqual({
        diagnosticos: fixture,
        isLoading: false,
        error: null,
      })
    })
  })

  it('returns modalidades and alfabetos populated in the diagnosticos result', async () => {
    const fixtureWithData: AllDiagnosticos = {
      causa: [],
      algoritmo: [],
      bloqueos: [],
      modalidades: [
        {
          id: 'm-1',
          codigo: 'M01',
          nombre: 'Modalidad 1',
          tipoDiscoNombre: 'Disco Azul',
          cantidadSesiones: 8,
          cantidadNiveles: 4,
          duracionMesesEstimada: 3,
          descripcionCorta: '8 discos · 4 niveles',
          activo: true,
        },
      ],
      alfabetos: [
        {
          id: 'alf-1',
          codigo: 'ALF01',
          nombre: 'Alfabeto 1',
          descripcion: null,
          rangoMax: 12,
          orden: 1,
          activo: true,
        },
      ],
    }
    ;(fetchAllDiagnosticos as jest.Mock).mockResolvedValue({
      data: fixtureWithData,
      error: null,
    })
    const { result } = renderHook(() => useFetchAllDiagnosticos())
    await waitFor(() => {
      expect(result.current).toEqual({
        diagnosticos: fixtureWithData,
        isLoading: false,
        error: null,
      })
    })
  })
})
