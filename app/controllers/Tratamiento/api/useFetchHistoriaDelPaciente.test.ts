import { renderHook, waitFor, act } from '@testing-library/react'
import type { EtapaHistoria, CentroEnergetico } from '../TratamientoTypes'
import { EtapaStatus } from '../TratamientoTypes'
import { fetchHistoriaDelPaciente } from './fetchHistoriaDelPaciente'
import { useFetchHistoriaDelPaciente } from './useFetchHistoriaDelPaciente'

jest.mock('./fetchHistoriaDelPaciente')

describe('useFetchHistoriaDelPaciente', () => {
  let etapaFixture: EtapaHistoria
  let centroFixture: CentroEnergetico

  beforeEach(() => {
    centroFixture = {
      id: 'centro-1',
      codigo: 'CE-01',
      nombre: 'Corona',
      etiquetaPaciente: 'Corona',
      orden: 1,
    }
    etapaFixture = {
      id: 'etapa-1',
      status: EtapaStatus.EN_CURSO,
      fechaInicio: '2025-01-01',
      fechaFin: null,
      diagnostico: {
        causa: {
          id: 'c-1',
          codigo: 'C',
          nombre: 'Causa',
          definicion: '',
          emocionesEsperadas: [],
          activo: true,
          etapas: [],
        },
        algoritmo: {
          id: 'a-1',
          codigo: 'A',
          nombre: 'Algo',
          definicion: '',
          comportamiento: '',
          comportamientoBadge: '',
          activo: true,
          etapas: [],
        },
        bloqueos: [],
      },
      modalidad: null,
      responsables: [],
      eventos: [],
      duracionMeses: 2,
      deltaScoreEtapa: null,
      motivoCierre: null,
      proximaEvaluacion: null,
      mediciones: [],
      alfabetos: [],
    }
  })

  it('noops when pacienteId is null returning idle state', async () => {
    const { result } = renderHook(() => useFetchHistoriaDelPaciente(null))
    await waitFor(() => {
      expect(result.current).toEqual({
        etapas: [],
        centros: [],
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with etapas and isLoading false on success', async () => {
    ;(fetchHistoriaDelPaciente as jest.Mock).mockResolvedValue({
      etapas: [etapaFixture],
      centros: [centroFixture],
      error: null,
    })

    const { result } = renderHook(() => useFetchHistoriaDelPaciente('p-1'))

    await waitFor(() => {
      expect(result.current).toEqual({
        etapas: [etapaFixture],
        centros: [centroFixture],
        isLoading: false,
        error: null,
        refresh: expect.any(Function),
      })
    })
  })

  it('resolves with error and empty etapas when fetch returns an error', async () => {
    ;(fetchHistoriaDelPaciente as jest.Mock).mockResolvedValue({
      etapas: [],
      centros: [],
      error: 'boom',
    })

    const { result } = renderHook(() => useFetchHistoriaDelPaciente('p-1'))

    await waitFor(() => {
      expect(result.current).toEqual({
        etapas: [],
        centros: [],
        isLoading: false,
        error: 'boom',
        refresh: expect.any(Function),
      })
    })
  })

  it('re-fetches when refresh is called', async () => {
    ;(fetchHistoriaDelPaciente as jest.Mock).mockResolvedValue({
      etapas: [etapaFixture],
      centros: [],
      error: null,
    })

    const { result } = renderHook(() => useFetchHistoriaDelPaciente('p-1'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect((fetchHistoriaDelPaciente as jest.Mock).mock.calls.length).toBe(2)
    })
  })
})
