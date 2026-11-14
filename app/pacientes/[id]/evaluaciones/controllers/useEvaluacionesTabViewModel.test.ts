import { renderHook } from '@testing-library/react'
import { useParams } from 'next/navigation'
import { useFetchEvaluacionesDelTratamientoActivo } from '@/app/controllers/Tratamiento'
import type {
  Tratamiento,
  Nivel,
  Evaluacion,
} from '@/app/controllers/Tratamiento'
import { TRATAMIENTO_STATE } from '@/app/controllers/Tratamiento'
import { useEvaluacionesTabViewModel } from './useEvaluacionesTabViewModel'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/app/controllers/Tratamiento', () => ({
  ...jest.requireActual('@/app/controllers/Tratamiento'),
  useFetchEvaluacionesDelTratamientoActivo: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const buildEvaluacion = (overrides: Partial<Evaluacion> = {}): Evaluacion => ({
  id: 'ev-1',
  score: 4,
  fechaRespuesta: '2025-06-01T00:00:00Z',
  ...overrides,
})

const buildNivel = (overrides: Partial<Nivel> = {}): Nivel => ({
  id: 'n-1',
  numeroNivel: 1,
  fechaSeguimientoEsperado: '2025-06-01T00:00:00Z',
  fechaSeguimientoReal: null,
  observaciones: null,
  evaluacion: null,
  ...overrides,
})

const buildTratamiento = (
  overrides: Partial<Tratamiento> = {},
): Tratamiento => ({
  id: 't-1',
  fechaInicio: '2025-01-01',
  fechaFin: null,
  diagnostico: {
    causa: {
      id: 'c-1',
      codigo: 'CAU01',
      nombre: 'Causa 1',
      definicion: 'def',
      emocionesEsperadas: ['tristeza'],
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
  estado: TRATAMIENTO_STATE.ACTIVO,
  niveles: [],
  entregasSemanales: [],
  ...overrides,
})

// ---------------------------------------------------------------------------
// Base mock return (null tratamiento, idle state)
// ---------------------------------------------------------------------------

const baseHookResult = {
  tratamiento: null,
  isLoading: false,
  error: null,
  refresh: jest.fn(),
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useEvaluacionesTabViewModel', () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-1' })
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue(
      baseHookResult,
    )
  })

  // --- loading & error forwarding ---

  it('returns isLoading true while the fetch is pending', () => {
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      isLoading: true,
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.isLoading).toBe(true)
  })

  it('forwards the error string when the fetch fails', () => {
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      error: 'boom',
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.error).toBe('boom')
  })

  // --- hasActiveTreatment ---

  it('returns hasActiveTreatment false when tratamiento is null', () => {
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.hasActiveTreatment).toBe(false)
  })

  it('returns hasActiveTreatment true when tratamiento is not null', () => {
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento(),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.hasActiveTreatment).toBe(true)
  })

  // --- hasStarted (INI-002) ---

  it('returns hasStarted false when tratamiento is null', () => {
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.hasStarted).toBe(false)
  })

  it('returns hasStarted false when tratamiento exists but fechaInicio is null (etapa pendiente)', () => {
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ fechaInicio: null }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.hasActiveTreatment).toBe(true)
    expect(result.current.hasStarted).toBe(false)
  })

  it('returns hasStarted true when tratamiento has a fechaInicio', () => {
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ fechaInicio: '2025-01-01' }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.hasStarted).toBe(true)
  })

  // --- pacienteId passthrough (INI-002, for the EtapaSinIniciarCard CTA) ---

  it('exposes the pacienteId from useParams', () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-42' })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.pacienteId).toBe('p-42')
  })

  // --- chartSlots when no tratamiento ---

  it('returns chartSlots as empty array when tratamiento is null', () => {
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.chartSlots).toEqual([])
  })

  // --- completedEvaluations when no tratamiento ---

  it('returns completedEvaluations as empty array when tratamiento is null', () => {
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.completedEvaluations).toEqual([])
  })

  // --- chartSlots derivation ---

  it('maps a completed nivel to a ChartSlot with the real score and isPending false', () => {
    const nivel = buildNivel({
      id: 'n-1',
      numeroNivel: 1,
      evaluacion: buildEvaluacion({ score: 3.5 }),
    })
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ niveles: [nivel] }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.chartSlots[0]).toEqual({
      nivelId: 'n-1',
      numeroNivel: 1,
      score: 3.5,
      realScore: 3.5,
      isPending: false,
    })
  })

  it('maps a pending nivel to a ChartSlot with score 5, realScore null, isPending true', () => {
    const nivel = buildNivel({ id: 'n-2', numeroNivel: 2, evaluacion: null })
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ niveles: [nivel] }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.chartSlots[0]).toEqual({
      nivelId: 'n-2',
      numeroNivel: 2,
      score: 5,
      realScore: null,
      isPending: true,
    })
  })

  it('sorts chartSlots ascending by numeroNivel regardless of input order', () => {
    const niveles = [
      buildNivel({ id: 'n-3', numeroNivel: 3 }),
      buildNivel({ id: 'n-1', numeroNivel: 1 }),
      buildNivel({ id: 'n-2', numeroNivel: 2 }),
    ]
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ niveles }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.chartSlots.map((s) => s.numeroNivel)).toEqual([
      1, 2, 3,
    ])
  })

  // --- completedEvaluations sorting ---

  it('returns completedEvaluations sorted descending by fechaRespuesta (most recent first)', () => {
    const niveles = [
      buildNivel({
        id: 'n-1',
        numeroNivel: 1,
        evaluacion: buildEvaluacion({
          id: 'ev-1',
          fechaRespuesta: '2025-03-01T00:00:00Z',
          score: 3,
        }),
      }),
      buildNivel({
        id: 'n-2',
        numeroNivel: 2,
        evaluacion: buildEvaluacion({
          id: 'ev-2',
          fechaRespuesta: '2025-06-01T00:00:00Z',
          score: 4,
        }),
      }),
    ]
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ niveles }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    expect(result.current.completedEvaluations.map((e) => e.nivelId)).toEqual([
      'n-2',
      'n-1',
    ])
  })

  // --- variation ---

  it('sets variation to "baseline" for the chronologically oldest evaluation', () => {
    const niveles = [
      buildNivel({
        id: 'n-1',
        numeroNivel: 1,
        evaluacion: buildEvaluacion({
          id: 'ev-1',
          fechaRespuesta: '2025-03-01T00:00:00Z',
          score: 3,
        }),
      }),
      buildNivel({
        id: 'n-2',
        numeroNivel: 2,
        evaluacion: buildEvaluacion({
          id: 'ev-2',
          fechaRespuesta: '2025-06-01T00:00:00Z',
          score: 4,
        }),
      }),
    ]
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ niveles }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    // Oldest is n-1 (March); it appears last in DESC display order
    const oldest =
      result.current.completedEvaluations[
        result.current.completedEvaluations.length - 1
      ]
    expect(oldest.variation).toBe('baseline')
  })

  it('sets variation as signed number (score delta vs previous in chronological order) for non-first evaluations', () => {
    const niveles = [
      buildNivel({
        id: 'n-1',
        numeroNivel: 1,
        evaluacion: buildEvaluacion({
          id: 'ev-1',
          fechaRespuesta: '2025-03-01T00:00:00Z',
          score: 3,
        }),
      }),
      buildNivel({
        id: 'n-2',
        numeroNivel: 2,
        evaluacion: buildEvaluacion({
          id: 'ev-2',
          fechaRespuesta: '2025-06-01T00:00:00Z',
          score: 4,
        }),
      }),
    ]
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ niveles }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    // Newest is n-2 (June, score 4); variation = 4 - 3 = 1
    const newest = result.current.completedEvaluations[0]
    expect(newest.variation).toBe(1)
  })

  // --- DEC-12 tie-breaker ---

  it('applies DEC-12 tie-breaker: same fechaRespuesta → higher numeroNivel ranks as more recent', () => {
    const sameDate = '2025-06-01T00:00:00Z'
    const niveles = [
      buildNivel({
        id: 'n-1',
        numeroNivel: 1,
        evaluacion: buildEvaluacion({
          id: 'ev-1',
          fechaRespuesta: sameDate,
          score: 3,
        }),
      }),
      buildNivel({
        id: 'n-2',
        numeroNivel: 2,
        evaluacion: buildEvaluacion({
          id: 'ev-2',
          fechaRespuesta: sameDate,
          score: 4,
        }),
      }),
    ]
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ niveles }),
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    // In chronological ASC with tie-breaker desc: n-1 (lower) comes first → baseline
    // n-2 (higher) comes second → variation = 4 - 3 = 1
    // Display is reversed: n-2 first (variation=1), n-1 last (baseline)
    expect(result.current.completedEvaluations[0].nivelId).toBe('n-2')
    expect(result.current.completedEvaluations[0].variation).toBe(1)
  })

  // --- refresh passthrough ---

  it('exposes the refresh function from the underlying hook', () => {
    const refresh = jest.fn()
    ;(useFetchEvaluacionesDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      refresh,
    })
    const { result } = renderHook(() => useEvaluacionesTabViewModel())
    result.current.refresh()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  // --- pacienteId passthrough ---

  it('passes the pacienteId from useParams to useFetchEvaluacionesDelTratamientoActivo', () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-99' })
    renderHook(() => useEvaluacionesTabViewModel())
    expect(useFetchEvaluacionesDelTratamientoActivo).toHaveBeenCalledWith(
      'p-99',
    )
  })
})
