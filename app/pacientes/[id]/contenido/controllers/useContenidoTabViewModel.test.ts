import { renderHook } from '@testing-library/react'
import { useParams } from 'next/navigation'
import { useFetchPlanContenidoDelTratamientoActivo } from '@/app/controllers/Tratamiento'
import type {
  Tratamiento,
  FrasesPorSemana,
} from '@/app/controllers/Tratamiento'
import { TRATAMIENTO_STATE } from '@/app/controllers/Tratamiento'
import { TIPO_CONTENIDO } from '@/app/controllers/Contenido'
import type { Contenido } from '@/app/controllers/Contenido'
import { useContenidoTabViewModel } from './useContenidoTabViewModel'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/app/controllers/Tratamiento', () => ({
  ...jest.requireActual('@/app/controllers/Tratamiento'),
  useFetchPlanContenidoDelTratamientoActivo: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const buildContenido = (
  overrides: {
    id?: string
    titulo?: string | null
    descripcion?: string | null
    tipo?: TIPO_CONTENIDO
  } = {},
): Contenido => {
  const {
    id = 'c-1',
    titulo = 'Video 1',
    descripcion = null,
    tipo = TIPO_CONTENIDO.VIDEO,
  } = overrides
  return {
    id,
    titulo,
    descripcion,
    tipo,
    contenido: { recursoRef: null, duracion: null },
    imagenes: [],
  }
}

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
  tratamiento: null as Tratamiento | null,
  semanasTotales: null as number | null,
  frasesPorSemana: {} as FrasesPorSemana,
  isLoading: false,
  error: null as string | null,
  refresh: jest.fn(),
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('useContenidoTabViewModel', () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-1' })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue(
      baseHookResult,
    )
  })

  // --- weeks shape ---

  it('returns 8 rows when semanasTotales is 8', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento(),
      semanasTotales: 8,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks.length).toBe(8)
  })

  it('returns 16 rows when semanasTotales is 16', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento(),
      semanasTotales: 16,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks.length).toBe(16)
  })

  it('returns weeks with numeroSemana ascending from 1 to N', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento(),
      semanasTotales: 3,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks.map((w) => w.numeroSemana)).toEqual([1, 2, 3])
  })

  it('returns empty weeks when tratamiento is null', () => {
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks).toEqual([])
  })

  it('returns empty weeks when semanasTotales is null', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento(),
      semanasTotales: null,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks).toEqual([])
  })

  // --- type mapping ---

  it('maps a VIDEO contenido to meditacion cell', () => {
    const video = buildContenido({
      id: 'v-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Mi Video',
    })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [video],
          },
        ],
      }),
      semanasTotales: 1,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0].slots.meditacion).toEqual({
      id: 'v-1',
      titulo: 'Mi Video',
      tipo: TIPO_CONTENIDO.VIDEO,
    })
  })

  it('maps an AUDIO contenido to mantra cell', () => {
    const audio = buildContenido({
      id: 'a-1',
      tipo: TIPO_CONTENIDO.AUDIO,
      titulo: 'Mi Audio',
    })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [audio],
          },
        ],
      }),
      semanasTotales: 1,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0].slots.mantra).toEqual({
      id: 'a-1',
      titulo: 'Mi Audio',
      tipo: TIPO_CONTENIDO.AUDIO,
    })
  })

  it('maps the frases for a week from frasesPorSemana, keyed by numeroSemana', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [],
          },
        ],
      }),
      semanasTotales: 1,
      frasesPorSemana: {
        1: [
          { orden: 1, origen: 'causa', texto: 'Frase causa' },
          { orden: 2, origen: 'algoritmo', texto: 'Frase algoritmo 1' },
          { orden: 3, origen: 'algoritmo', texto: 'Frase algoritmo 2' },
        ],
      },
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0].frases).toEqual([
      { orden: 1, origen: 'causa', texto: 'Frase causa' },
      { orden: 2, origen: 'algoritmo', texto: 'Frase algoritmo 1' },
      { orden: 3, origen: 'algoritmo', texto: 'Frase algoritmo 2' },
    ])
  })

  it('returns an empty frases array for a week absent from frasesPorSemana', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [],
          },
        ],
      }),
      semanasTotales: 1,
      frasesPorSemana: {},
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0].frases).toEqual([])
  })

  it('returns an empty frases array for every week when paciente has no plan', () => {
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks).toEqual([])
  })

  // --- los 5 slots del plan (BETA-020) ---

  it('fills the 5 slots of a week that has the 5 tipos', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [
              buildContenido({
                id: 'i-1',
                tipo: TIPO_CONTENIDO.IC,
                titulo: 'Mi IC',
              }),
              buildContenido({
                id: 'v-1',
                tipo: TIPO_CONTENIDO.VIDEO,
                titulo: 'Mi Video',
              }),
              buildContenido({
                id: 'm-1',
                tipo: TIPO_CONTENIDO.CMA,
                titulo: 'Mi CMA',
              }),
              buildContenido({
                id: 'a-1',
                tipo: TIPO_CONTENIDO.AUDIO,
                titulo: 'Mi Audio',
              }),
              buildContenido({
                id: 'e-1',
                tipo: TIPO_CONTENIDO.EGREGOR,
                titulo: 'Mi Egregor',
              }),
            ],
          },
        ],
      }),
      semanasTotales: 1,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0].slots).toEqual({
      meditacion: { id: 'v-1', titulo: 'Mi Video', tipo: TIPO_CONTENIDO.VIDEO },
      mantra: { id: 'a-1', titulo: 'Mi Audio', tipo: TIPO_CONTENIDO.AUDIO },
      egregor: {
        id: 'e-1',
        titulo: 'Mi Egregor',
        tipo: TIPO_CONTENIDO.EGREGOR,
      },
      cma: { id: 'm-1', titulo: 'Mi CMA', tipo: TIPO_CONTENIDO.CMA },
      ic: { id: 'i-1', titulo: 'Mi IC', tipo: TIPO_CONTENIDO.IC },
    })
  })

  it('leaves the egregor slot null in a week without egregor', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [
              buildContenido({ id: 'v-1', tipo: TIPO_CONTENIDO.VIDEO }),
              buildContenido({ id: 'a-1', tipo: TIPO_CONTENIDO.AUDIO }),
              buildContenido({ id: 'm-1', tipo: TIPO_CONTENIDO.CMA }),
              buildContenido({ id: 'i-1', tipo: TIPO_CONTENIDO.IC }),
            ],
          },
        ],
      }),
      semanasTotales: 1,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0].slots.egregor).toBeNull()
  })

  // --- partial week ---

  it('sets absent types to null in a partial week', () => {
    const video = buildContenido({
      id: 'v-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Solo Video',
    })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [video],
          },
        ],
      }),
      semanasTotales: 1,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0]).toEqual({
      numeroSemana: 1,
      slots: {
        meditacion: {
          id: 'v-1',
          titulo: 'Solo Video',
          tipo: TIPO_CONTENIDO.VIDEO,
        },
        mantra: null,
        egregor: null,
        cma: null,
        ic: null,
      },
      frases: [],
    })
  })

  // --- week with no entrega ---

  it('returns a row with all cells null for a week without entrega', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ entregasSemanales: [] }),
      semanasTotales: 2,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0]).toEqual({
      numeroSemana: 1,
      slots: {
        meditacion: null,
        mantra: null,
        egregor: null,
        cma: null,
        ic: null,
      },
      frases: [],
    })
  })

  // --- collision ---

  it('takes the first VIDEO in the array when two videos are present in the same week', () => {
    const first = buildContenido({
      id: 'v-first',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'First',
    })
    const second = buildContenido({
      id: 'v-second',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Second',
    })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [first, second],
          },
        ],
      }),
      semanasTotales: 1,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.weeks[0].slots.meditacion).toEqual({
      id: 'v-first',
      titulo: 'First',
      tipo: TIPO_CONTENIDO.VIDEO,
    })
  })

  // --- hasContent ---

  it('returns hasContent false when tratamiento is null', () => {
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.hasContent).toBe(false)
  })

  it('returns hasContent false when entregasSemanales is empty', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({ entregasSemanales: [] }),
      semanasTotales: 8,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.hasContent).toBe(false)
  })

  it('returns hasContent true when entregasSemanales has at least one entry', () => {
    const video = buildContenido({
      id: 'v-1',
      tipo: TIPO_CONTENIDO.VIDEO,
      titulo: 'Video',
    })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      tratamiento: buildTratamiento({
        entregasSemanales: [
          {
            id: 'semana-1',
            numeroSemana: 1,
            fechaEntregada: null,
            fechaEntregaEsperada: null,
            contenido: [video],
          },
        ],
      }),
      semanasTotales: 8,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.hasContent).toBe(true)
  })

  // --- isLoading / error pass-through ---

  it('returns isLoading true while the fetch is pending', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      isLoading: true,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.isLoading).toBe(true)
  })

  it('forwards the error string when the fetch fails', () => {
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      error: 'boom',
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.error).toBe('boom')
  })

  // --- refresh pass-through ---

  it('exposes the refresh function from the underlying hook', () => {
    const refresh = jest.fn()
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      ...baseHookResult,
      refresh,
    })
    const { result } = renderHook(() => useContenidoTabViewModel())
    result.current.refresh()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  // --- pacienteId passthrough ---

  it('passes the pacienteId from useParams to useFetchPlanContenidoDelTratamientoActivo', () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-99' })
    renderHook(() => useContenidoTabViewModel())
    expect(useFetchPlanContenidoDelTratamientoActivo).toHaveBeenCalledWith(
      'p-99',
    )
  })

  it('exposes pacienteId in the return value', () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-42' })
    const { result } = renderHook(() => useContenidoTabViewModel())
    expect(result.current.pacienteId).toBe('p-42')
  })
})
