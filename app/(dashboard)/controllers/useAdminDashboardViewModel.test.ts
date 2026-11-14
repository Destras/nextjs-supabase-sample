import { renderHook } from '@testing-library/react'
import {
  useFetchTerapeutasDashboard,
  TERAPEUTA_STATE,
} from '@/app/controllers/Terapeuta'
import type { TerapeutaRollup } from '@/app/controllers/Terapeuta'
import { useFetchAdminDashboardStats } from '@/app/controllers/AdminDashboard'
import type { AdminDashboardStats } from '@/app/controllers/AdminDashboard'
import { useAdminDashboardViewModel } from './useAdminDashboardViewModel'
import { deriveMesCalendarioLabels } from './utils'

jest.mock('@/app/controllers/Terapeuta', () => ({
  ...jest.requireActual('@/app/controllers/Terapeuta'),
  useFetchTerapeutasDashboard: jest.fn(),
}))
jest.mock('@/app/controllers/AdminDashboard', () => ({
  useFetchAdminDashboardStats: jest.fn(),
}))
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  deriveMesCalendarioLabels: jest.fn(() => ({
    actual: 'MES_ACTUAL_MOCK',
    siguiente: 'MES_SIGUIENTE_MOCK',
  })),
}))

const buildRollup = (overrides: Partial<TerapeutaRollup>): TerapeutaRollup => ({
  id: 't-x',
  nombre: 'Generic',
  estado: TERAPEUTA_STATE.ACTIVO,
  pacientesActivos: 3,
  scorePromedio: null,
  alertasActivas: null,
  ...overrides,
})

const STATS_FIXTURE: AdminDashboardStats = {
  pacientesActivos: 12,
  nuevosEsteMes: 2,
  alertasTotales: 3,
  scorePromedio: 3.6,
  distribucionEtapa: [{ label: '1', cantidad: 12, pct: 100 }],
  distribucionMes: [
    { label: '1', cantidad: 18, pct: 47 },
    { label: '2', cantidad: 9, pct: 24 },
    { label: '3', cantidad: 6, pct: 16 },
    { label: '4', cantidad: 4, pct: 11 },
  ],
}

describe('useAdminDashboardViewModel', () => {
  beforeEach(() => {
    ;(useFetchTerapeutasDashboard as jest.Mock).mockReturnValue({
      terapeutas: [],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    ;(useFetchAdminDashboardStats as jest.Mock).mockReturnValue({
      stats: STATS_FIXTURE,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
  })

  it('composes stats, counts and distribuciones', () => {
    const laura = buildRollup({
      id: 't-1',
      nombre: 'Laura',
      pacientesActivos: 6,
      scorePromedio: 3.8,
      alertasActivas: 1,
    })
    const diego = buildRollup({
      id: 't-2',
      nombre: 'Diego',
      pacientesActivos: 4,
      scorePromedio: 3.4,
      alertasActivas: 2,
    })
    const ana = buildRollup({ id: 't-3', nombre: 'Ana', pacientesActivos: 0 })
    const pablo = buildRollup({
      id: 't-4',
      nombre: 'Pablo',
      estado: TERAPEUTA_STATE.PENDIENTE,
      pacientesActivos: 0,
    })
    ;(useFetchTerapeutasDashboard as jest.Mock).mockReturnValue({
      terapeutas: [laura, diego, ana, pablo],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    const { result } = renderHook(() => useAdminDashboardViewModel())
    expect(result.current).toEqual({
      stats: {
        pacientesActivos: 12,
        nuevosEsteMes: 2,
        terapeutasActivos: 3,
        invitacionesPendientes: 1,
        alertasTotales: 3,
      },
      // pablo (pendiente) queda afuera — la tabla solo muestra activos, los
      // pendientes ya se surfacean en el hero stat "Invitaciones pendientes".
      cargaPorTerapeuta: [laura, diego, ana],
      distribucionEtapa: [{ label: '1', cantidad: 12, pct: 100 }],
      distribucionMes: STATS_FIXTURE.distribucionMes,
      // Literal, hand-computed (regression, code-review): antes esta
      // expectation llamaba a deriveProyeccionMesSiguiente con el mismo
      // fixture que usa el VM — tautológico, pasaba aunque el VM rompiera
      // el wiring. Mes 1→2 (18/33=54.5%→55), 2→3 (9/33=27.3%→27),
      // 3→4 (6/33=18.2%→18); mes 4 (hoy) cierra tratamiento y no se proyecta.
      distribucionMesSiguiente: [
        { label: '2', cantidad: 18, pct: 55 },
        { label: '3', cantidad: 9, pct: 27 },
        { label: '4', cantidad: 6, pct: 18 },
      ],
      hasTerapeutas: true,
      isLoading: false,
      error: null,
      mesActualLabel: 'MES_ACTUAL_MOCK',
      mesSiguienteLabel: 'MES_SIGUIENTE_MOCK',
    })
  })

  it('derives the calendar month labels from now (DEC-4)', () => {
    renderHook(() => useAdminDashboardViewModel())
    expect(deriveMesCalendarioLabels).toHaveBeenCalledWith(expect.any(Date))
  })

  // Regression (code-review): hasTerapeutas venía de rollup.length (todos los
  // estados) mientras cargaPorTerapeuta ya filtraba a solo ACTIVO — un admin
  // con la red entera en "pendiente" veía la tabla sin filas en vez del empty
  // state, porque hasTerapeutas seguía dando true.
  it('reports hasTerapeutas false when every terapeuta is pendiente (matches the filtered table, not the raw rollup)', () => {
    const pendiente1 = buildRollup({
      id: 't-1',
      nombre: 'Pendiente Uno',
      estado: TERAPEUTA_STATE.PENDIENTE,
      pacientesActivos: 0,
    })
    const pendiente2 = buildRollup({
      id: 't-2',
      nombre: 'Pendiente Dos',
      estado: TERAPEUTA_STATE.PENDIENTE,
      pacientesActivos: 0,
    })
    ;(useFetchTerapeutasDashboard as jest.Mock).mockReturnValue({
      terapeutas: [pendiente1, pendiente2],
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    const { result } = renderHook(() => useAdminDashboardViewModel())
    expect({
      cargaPorTerapeuta: result.current.cargaPorTerapeuta,
      hasTerapeutas: result.current.hasTerapeutas,
    }).toEqual({ cargaPorTerapeuta: [], hasTerapeutas: false })
  })

  it('reports an empty network with zeroed stats and no terapeutas', () => {
    ;(useFetchAdminDashboardStats as jest.Mock).mockReturnValue({
      stats: null,
      isLoading: false,
      error: null,
      refresh: jest.fn(),
    })
    const { result } = renderHook(() => useAdminDashboardViewModel())
    expect(result.current).toEqual({
      stats: {
        pacientesActivos: 0,
        nuevosEsteMes: 0,
        terapeutasActivos: 0,
        invitacionesPendientes: 0,
        alertasTotales: null,
      },
      cargaPorTerapeuta: [],
      distribucionEtapa: [],
      distribucionMes: [],
      distribucionMesSiguiente: [],
      hasTerapeutas: false,
      isLoading: false,
      error: null,
      mesActualLabel: 'MES_ACTUAL_MOCK',
      mesSiguienteLabel: 'MES_SIGUIENTE_MOCK',
    })
  })

  it('reports isLoading while either source is loading', () => {
    ;(useFetchAdminDashboardStats as jest.Mock).mockReturnValue({
      stats: null,
      isLoading: true,
      error: null,
      refresh: jest.fn(),
    })
    const { result } = renderHook(() => useAdminDashboardViewModel())
    expect(result.current.isLoading).toBe(true)
  })

  it('surfaces the stats fetch error', () => {
    ;(useFetchAdminDashboardStats as jest.Mock).mockReturnValue({
      stats: null,
      isLoading: false,
      error: 'no_autorizado',
      refresh: jest.fn(),
    })
    const { result } = renderHook(() => useAdminDashboardViewModel())
    expect(result.current.error).toBe('no_autorizado')
  })

  it('surfaces the rollup fetch error', () => {
    ;(useFetchTerapeutasDashboard as jest.Mock).mockReturnValue({
      terapeutas: [],
      isLoading: false,
      error: 'rollup boom',
      refresh: jest.fn(),
    })
    const { result } = renderHook(() => useAdminDashboardViewModel())
    expect(result.current.error).toBe('rollup boom')
  })
})
