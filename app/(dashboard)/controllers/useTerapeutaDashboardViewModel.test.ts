import { renderHook } from '@testing-library/react'
import {
  useFetchPacientesByTerapeuta,
  useFetchPacientesSinIniciar,
} from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { useFetchAlertasTerapeuta } from '@/app/controllers/Alerta'
import type { Alerta } from '@/app/controllers/Alerta'
import { ALERTA_TIPO } from '@/app/controllers/Alerta'
import { buildSaludo, deriveMesCalendarioLabels } from './utils'
import { useTerapeutaDashboardViewModel } from './useTerapeutaDashboardViewModel'

jest.mock('@/app/controllers/Paciente', () => ({
  ...jest.requireActual('@/app/controllers/Paciente'),
  useFetchPacientesByTerapeuta: jest.fn(),
  useFetchPacientesSinIniciar: jest.fn(),
}))
jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))
jest.mock('@/app/controllers/Alerta', () => ({
  ...jest.requireActual('@/app/controllers/Alerta'),
  useFetchAlertasTerapeuta: jest.fn(),
}))
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  buildSaludo: jest.fn(() => 'SALUDO_MOCK'),
  deriveMesCalendarioLabels: jest.fn(() => ({
    actual: 'MES_ACTUAL_MOCK',
    siguiente: 'MES_SIGUIENTE_MOCK',
  })),
}))

const buildAlerta = (overrides: Partial<Alerta>): Alerta => ({
  tipo: ALERTA_TIPO.SCORE_BAJO,
  prioridad: 'alta',
  pacienteId: 'p-x',
  pacienteNombre: 'Generic',
  terapeutaId: 't-1',
  terapeutaNombre: null,
  nombre: 'Score bajo',
  icono: '↘',
  mensaje: 'score bajo',
  eventoRef: 'ref-x',
  fecha: '2026-07-01',
  descartable: true,
  ...overrides,
})

const buildPaciente = (overrides: Partial<Paciente>): Paciente => ({
  id: 'p-x',
  nombre: 'Generic',
  nivelFinalizado: false,
  mesActual: null,
  mesesTotales: null,
  etapaOrdinal: null,
  evaluaciones: [],
  semanaGlobal: null,
  semanasTotales: null,
  fechaInicioEtapaActiva: null,
  etapaActivaId: null,
  sinIniciar: false,
  modalidadResumen: null,
  causaActual: null,
  bloqueosIdentificados: [],
  algoritmoActual: null,
  alfabetosActuales: [],
  ultimoScore: null,
  tendencia: 'flat',
  tieneAlerta: false,
  ultimaEvaluacion: null,
  proximaEvaluacion: null,
  inicioTratamiento: { estado: 'sin_tratamiento', fecha: null },
  tieneCuenta: false,
  bienvenidaRecibida: false,
  generalInfo: {
    telefono: null,
    email: null,
    fechaNacimiento: null,
    edad: null,
    fechaAlta: null,
  },
  state: PACIENTE_STATE.ACTIVE,
  ...overrides,
})

describe('useTerapeutaDashboardViewModel', () => {
  beforeEach(() => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: null,
    })
    ;(useFetchPacientesSinIniciar as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: null,
    })
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-1',
        name: 'Sofía',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 'sofia@test.com',
      },
      isLoading: false,
      error: null,
    })
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
  })

  it('composes the derivadores for a caseload with scores and real alertas', () => {
    const p1 = buildPaciente({
      id: 'p-1',
      etapaOrdinal: 1,
      mesActual: 1,
      mesesTotales: 4,
      causaActual: {
        nombre: 'Trauma',
        definicion: null,
        emocionesEsperadas: null,
      },
      ultimoScore: 2,
      tendencia: 'down',
      tieneAlerta: true,
    })
    const p2 = buildPaciente({
      id: 'p-2',
      etapaOrdinal: 1,
      mesActual: 2,
      mesesTotales: 4,
      causaActual: {
        nombre: 'Trauma',
        definicion: null,
        emocionesEsperadas: null,
      },
      ultimoScore: 4,
      tendencia: 'up',
      tieneAlerta: false,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [p1, p2],
      isLoading: false,
      error: null,
    })
    // Solo p1 tiene una alerta activa — p2 no debe aparecer en
    // "requieren tu mirada" aunque tenga un score más alto/bajo.
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [buildAlerta({ pacienteId: 'p-1' })],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current).toEqual({
      saludo: 'SALUDO_MOCK',
      stats: { activos: 2, nuevosEsteMes: 0, scorePromedio: 3 },
      requierenMirada: [p1],
      distribucionEtapa: [{ label: '1', cantidad: 2, pct: 100 }],
      // Contrato nuevo (fix code-review): distribucionMes emite SIEMPRE 1..N
      // (N = mesesTotales = 4), 0 en los meses sin pacientes hoy.
      distribucionMes: [
        { label: '1', cantidad: 1, pct: 50 },
        { label: '2', cantidad: 1, pct: 50 },
        { label: '3', cantidad: 0, pct: 0 },
        { label: '4', cantidad: 0, pct: 0 },
      ],
      distribucionMesSiguiente: [
        { label: '2', cantidad: 1, pct: 50 },
        { label: '3', cantidad: 1, pct: 50 },
        { label: '4', cantidad: 0, pct: 0 },
      ],
      sinIniciar: [],
      hasPacientes: true,
      hasEvaluaciones: true,
      isLoading: false,
      error: null,
      mesActualLabel: 'MES_ACTUAL_MOCK',
      mesSiguienteLabel: 'MES_SIGUIENTE_MOCK',
      emptyState: {
        title: 'Todavía no tenés',
        titleHighlight: 'pacientes',
        message:
          'Empezá cargando al primero para ver acá la salud de tus pacientes.',
        ctaLabel: 'Cargar tu primer paciente',
        ctaHref: '/pacientes/nuevo',
      },
    })
  })

  it('excludes pacientes whose only alerta is not score_bajo (DEC-2)', () => {
    const p1 = buildPaciente({ id: 'p-1', ultimoScore: 2 })
    const p2 = buildPaciente({ id: 'p-2', ultimoScore: 1 })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [p1, p2],
      isLoading: false,
      error: null,
    })
    // p1 solo tiene una alerta eval_vencida (no score_bajo) → no debe aparecer
    // en "requieren tu mirada"; p2 tiene score_bajo → sí aparece.
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [
        buildAlerta({ pacienteId: 'p-1', tipo: ALERTA_TIPO.EVAL_VENCIDA }),
        buildAlerta({ pacienteId: 'p-2', tipo: ALERTA_TIPO.SCORE_BAJO }),
      ],
      tipos: [],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current.requierenMirada.map((p) => p.id)).toEqual(['p-2'])
  })

  it('reports an empty caseload with honest empties', () => {
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current).toEqual({
      saludo: 'SALUDO_MOCK',
      stats: {
        activos: 0,
        nuevosEsteMes: 0,
        scorePromedio: null,
      },
      requierenMirada: [],
      distribucionEtapa: [],
      distribucionMes: [],
      distribucionMesSiguiente: [],
      sinIniciar: [],
      hasPacientes: false,
      hasEvaluaciones: false,
      isLoading: false,
      error: null,
      mesActualLabel: 'MES_ACTUAL_MOCK',
      mesSiguienteLabel: 'MES_SIGUIENTE_MOCK',
      emptyState: {
        title: 'Todavía no tenés',
        titleHighlight: 'pacientes',
        message:
          'Empezá cargando al primero para ver acá la salud de tus pacientes.',
        ctaLabel: 'Cargar tu primer paciente',
        ctaHref: '/pacientes/nuevo',
      },
    })
  })

  it('keeps Tier B metrics empty when the caseload has no scores yet (día-1)', () => {
    const p1 = buildPaciente({
      id: 'p-1',
      etapaOrdinal: 1,
      causaActual: {
        nombre: 'Trauma',
        definicion: null,
        emocionesEsperadas: null,
      },
      ultimoScore: null,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [p1],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current).toEqual({
      saludo: 'SALUDO_MOCK',
      stats: {
        activos: 1,
        nuevosEsteMes: 0,
        scorePromedio: null,
      },
      requierenMirada: [],
      distribucionEtapa: [{ label: '1', cantidad: 1, pct: 100 }],
      distribucionMes: [{ label: 'Sin etapa', cantidad: 1, pct: 100 }],
      distribucionMesSiguiente: [],
      sinIniciar: [],
      hasPacientes: true,
      hasEvaluaciones: false,
      isLoading: false,
      error: null,
      mesActualLabel: 'MES_ACTUAL_MOCK',
      mesSiguienteLabel: 'MES_SIGUIENTE_MOCK',
      emptyState: {
        title: 'Todavía no tenés',
        titleHighlight: 'pacientes',
        message:
          'Empezá cargando al primero para ver acá la salud de tus pacientes.',
        ctaLabel: 'Cargar tu primer paciente',
        ctaHref: '/pacientes/nuevo',
      },
    })
  })

  it('surfaces the fetch error', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: 'boom',
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current.error).toBe('boom')
  })

  it('reports isLoading while the pacientes fetch is in flight', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current.isLoading).toBe(true)
  })

  it('reports isLoading while the profile is still resolving', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current.isLoading).toBe(true)
  })

  it('builds the saludo from the profile name', () => {
    renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(buildSaludo).toHaveBeenCalledWith('Sofía', expect.any(Date))
  })

  it('exposes the pacientes sin iniciar from its dedicated hook', () => {
    ;(useFetchPacientesSinIniciar as jest.Mock).mockReturnValue({
      pacientes: [{ id: 'p-9', nombre: 'Sin Plan' }],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current.sinIniciar).toEqual([
      { id: 'p-9', nombre: 'Sin Plan' },
    ])
  })

  it('reports isLoading while the sin-iniciar fetch is in flight', () => {
    ;(useFetchPacientesSinIniciar as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current.isLoading).toBe(true)
  })

  it('reports isLoading while the alertas fetch is in flight', () => {
    ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      tipos: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(result.current.isLoading).toBe(true)
  })

  it('calls useFetchAlertasTerapeuta without arguments (RLS-scoped server-side)', () => {
    renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(useFetchAlertasTerapeuta).toHaveBeenCalledWith()
  })

  it('derives the calendar month labels from now (DEC-4)', () => {
    renderHook(() => useTerapeutaDashboardViewModel('u-1'))
    expect(deriveMesCalendarioLabels).toHaveBeenCalledWith(expect.any(Date))
  })

  it('exposes admin-flavored empty-state copy when the profile role is admin (DAS-001)', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-admin',
        name: 'Admin',
        role: ROLE.ADMIN,
        timezone: 'UTC',
        email: 'admin@clienteapp.test',
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() =>
      useTerapeutaDashboardViewModel('u-admin'),
    )
    expect(result.current.emptyState).toEqual({
      title: 'No tenés pacientes',
      titleHighlight: 'asignados',
      message:
        'Tu vista general de la red está en «General». Acá vas a ver tus casos propios apenas tengas un paciente asignado.',
      ctaLabel: 'Cargar un paciente',
      ctaHref: '/pacientes/nuevo',
    })
  })
})
