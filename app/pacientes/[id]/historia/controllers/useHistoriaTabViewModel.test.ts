import { renderHook } from '@testing-library/react'
import { useParams } from 'next/navigation'
import { useFetchHistoriaDelPaciente } from '@/app/controllers/Tratamiento'
import type {
  EtapaHistoria,
  CentroEnergetico,
} from '@/app/controllers/Tratamiento'
import { EtapaStatus } from '@/app/controllers/Tratamiento'
import { useHistoriaTabViewModel } from './useHistoriaTabViewModel'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/app/controllers/Tratamiento', () => ({
  ...jest.requireActual('@/app/controllers/Tratamiento'),
  useFetchHistoriaDelPaciente: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const buildEtapa = (overrides: Partial<EtapaHistoria> = {}): EtapaHistoria => ({
  id: 'etapa-1',
  status: EtapaStatus.EN_CURSO,
  fechaInicio: '2025-01-01',
  fechaFin: null,
  diagnostico: {
    causa: {
      id: 'c-1',
      codigo: 'CAU01',
      nombre: 'Causa 1',
      definicion: 'def',
      emocionesEsperadas: [],
      activo: true,
      etapas: [],
    },
    bloqueos: [],
    algoritmo: {
      id: 'a-1',
      codigo: 'ALG01',
      nombre: 'Algoritmo 1',
      definicion: 'def',
      comportamiento: 'comp',
      comportamientoBadge: '',
      activo: true,
      etapas: [],
    },
  },
  modalidad: null,
  responsables: [],
  eventos: [],
  duracionMeses: null,
  deltaScoreEtapa: null,
  motivoCierre: null,
  proximaEvaluacion: null,
  mediciones: [],
  alfabetos: [],
  ...overrides,
})

// ---------------------------------------------------------------------------
// Base mock return (empty etapas, idle state)
// ---------------------------------------------------------------------------

const baseHookResult = {
  etapas: [] as ReadonlyArray<EtapaHistoria>,
  centros: [] as ReadonlyArray<CentroEnergetico>,
  isLoading: false,
  error: null,
  refresh: jest.fn(),
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useHistoriaTabViewModel', () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-1' })
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue(baseHookResult)
  })

  // --- loading ---

  it('returns isLoading true while the fetch is pending', () => {
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue({
      ...baseHookResult,
      isLoading: true,
    })
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.isLoading).toBe(true)
  })

  // --- error ---

  it('forwards the error string when the fetch fails', () => {
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue({
      ...baseHookResult,
      error: 'boom',
    })
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.error).toBe('boom')
  })

  // --- empty ---

  it('returns isEmpty true when etapas is empty', () => {
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.isEmpty).toBe(true)
  })

  it('returns capitulos as empty array when etapas is empty', () => {
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.capitulos).toEqual([])
  })

  // --- ready: etapa en curso exists ---

  it('sets expandidoInicial true only for the etapa with status EN_CURSO', () => {
    const etapaEnCurso = buildEtapa({
      id: 'e-1',
      status: EtapaStatus.EN_CURSO,
    })
    const etapaFinalizada = buildEtapa({
      id: 'e-2',
      status: EtapaStatus.FINALIZADA,
    })
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue({
      ...baseHookResult,
      etapas: [etapaEnCurso, etapaFinalizada],
    })
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.capitulos).toEqual([
      { etapa: etapaEnCurso, expandidoInicial: true },
      { etapa: etapaFinalizada, expandidoInicial: false },
    ])
  })

  // --- ready: no etapa en curso → first capitulo expanded ---

  it('sets expandidoInicial true for the first capitulo when no etapa is en curso', () => {
    const etapa1 = buildEtapa({
      id: 'e-1',
      status: EtapaStatus.FINALIZADA,
    })
    const etapa2 = buildEtapa({
      id: 'e-2',
      status: EtapaStatus.ABANDONADA,
    })
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue({
      ...baseHookResult,
      etapas: [etapa1, etapa2],
    })
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.capitulos).toEqual([
      { etapa: etapa1, expandidoInicial: true },
      { etapa: etapa2, expandidoInicial: false },
    ])
  })

  // --- isEmpty false when etapas present ---

  it('returns isEmpty false when etapas has at least one entry', () => {
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue({
      ...baseHookResult,
      etapas: [buildEtapa()],
    })
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.isEmpty).toBe(false)
  })

  // --- centros passthrough ---

  it('exposes the centros array from the underlying hook', () => {
    const centros: ReadonlyArray<CentroEnergetico> = [
      {
        id: 'c-1',
        codigo: 'RAIZ',
        nombre: 'Raíz',
        etiquetaPaciente: 'Raíz',
        orden: 1,
      },
    ]
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue({
      ...baseHookResult,
      centros,
    })
    const { result } = renderHook(() => useHistoriaTabViewModel())
    expect(result.current.centros).toEqual(centros)
  })

  // --- refresh passthrough ---

  it('exposes the refresh function from the underlying hook', () => {
    const refresh = jest.fn()
    ;(useFetchHistoriaDelPaciente as jest.Mock).mockReturnValue({
      ...baseHookResult,
      refresh,
    })
    const { result } = renderHook(() => useHistoriaTabViewModel())
    result.current.refresh()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  // --- pacienteId passthrough ---

  it('passes the pacienteId from useParams to useFetchHistoriaDelPaciente', () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-99' })
    renderHook(() => useHistoriaTabViewModel())
    expect(useFetchHistoriaDelPaciente).toHaveBeenCalledWith('p-99')
  })
})
