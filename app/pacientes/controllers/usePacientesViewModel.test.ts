import { act, renderHook } from '@testing-library/react'
import { useCurrentUserId } from '@/app/controllers/Auth'
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import { useFetchAlertasTerapeuta } from '@/app/controllers/Alerta'
import type { Alerta } from '@/app/controllers/Alerta'
import { ALERTA_TIPO } from '@/app/controllers/Alerta'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { usePacientesViewModel } from './usePacientesViewModel'

import { useSearchParams } from 'next/navigation'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserId: jest.fn(),
}))
jest.mock('@/app/controllers/Paciente', () => ({
  ...jest.requireActual('@/app/controllers/Paciente'),
  useFetchPacientesByTerapeuta: jest.fn(),
}))
jest.mock('@/app/controllers/Alerta', () => ({
  ...jest.requireActual('@/app/controllers/Alerta'),
  useFetchAlertasTerapeuta: jest.fn(),
}))
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}))

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

const buildAlerta = (overrides: Partial<Alerta> = {}): Alerta => ({
  tipo: ALERTA_TIPO.MES_3,
  prioridad: 'media',
  pacienteId: 'p-3',
  pacienteNombre: 'Pedro',
  terapeutaId: 't-1',
  terapeutaNombre: null,
  nombre: 'Mes 3',
  icono: '◷',
  mensaje: 'Entró al mes 3',
  eventoRef: 'ev-1',
  fecha: null,
  descartable: true,
  ...overrides,
})

const mockAlertas = (
  overrides: Partial<ReturnType<typeof useFetchAlertasTerapeuta>> = {},
): void => {
  ;(useFetchAlertasTerapeuta as jest.Mock).mockReturnValue({
    alertas: [],
    tipos: [],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  })
}

const baseResult = {
  pacientes: [],
  isLoading: false,
  error: null,
  filter: 'todos' as const,
  searchQuery: '',
  setFilter: expect.any(Function),
  setSearchQuery: expect.any(Function),
  counts: { total: 0, activos: 0, conAlerta: 0 },
}

describe('usePacientesViewModel', () => {
  beforeEach(() => {
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: 't-1',
      error: null,
      isLoading: false,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: null,
    })
    mockAlertas()
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(''))
  })

  it('initializes filter from the ?filtro=alerta query param', () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('filtro=alerta'),
    )
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current.filter).toBe('alerta')
  })

  it('ignores an invalid filtro query param and falls back to todos', () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('filtro=loquesea'),
    )
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current.filter).toBe('todos')
  })

  it('reacts to the filtro query param changing after mount (no remount)', () => {
    ;(useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(''))
    const { result, rerender } = renderHook(() => usePacientesViewModel())
    expect(result.current.filter).toBe('todos')
    ;(useSearchParams as jest.Mock).mockReturnValue(
      new URLSearchParams('filtro=alerta'),
    )
    rerender()
    expect(result.current.filter).toBe('alerta')
  })

  it('reports isLoading true while the auth hook is still resolving', () => {
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: null,
      error: null,
      isLoading: true,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current).toEqual({
      ...baseResult,
      isLoading: true,
    })
  })

  it('prefers the auth error over the fetch error when both are present', () => {
    ;(useCurrentUserId as jest.Mock).mockReturnValue({
      userId: null,
      error: 'auth failed',
      isLoading: false,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: 'fetch failed',
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current).toEqual({
      ...baseResult,
      error: 'auth failed',
    })
  })

  it('falls back to the fetch error when there is no auth error', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: 'fetch failed',
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current).toEqual({
      ...baseResult,
      error: 'fetch failed',
    })
  })

  it('starts with filter=todos and empty searchQuery', () => {
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current).toEqual(baseResult)
  })

  it('computes counts from the unfiltered pacientes', () => {
    const juan = buildPaciente({
      id: 'p-1',
      nombre: 'Juan',
      mesActual: 1,
      etapaActivaId: 'etapa-1',
    })
    const maria = buildPaciente({ id: 'p-2', nombre: 'Maria' })
    const pedro = buildPaciente({
      id: 'p-3',
      nombre: 'Pedro',
      mesActual: 2,
      etapaActivaId: 'etapa-3',
    })
    mockAlertas({ alertas: [buildAlerta({ pacienteId: 'p-3' })] })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [juan, maria, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current).toEqual({
      ...baseResult,
      pacientes: [juan, maria, { ...pedro, tieneAlerta: true }],
      counts: { total: 3, activos: 3, conAlerta: 1 },
    })
  })

  it('no cuenta como activo a un paciente pausado ni a uno dado de baja, aunque tengan una etapa abierta', () => {
    const activo = buildPaciente({
      id: 'p-1',
      nombre: 'Activa',
      mesActual: 1,
      etapaActivaId: 'etapa-1',
    })
    const pausado = buildPaciente({
      id: 'p-2',
      nombre: 'Pausado',
      mesActual: 2,
      etapaActivaId: 'etapa-2',
      state: PACIENTE_STATE.PAUSED,
    })
    const baja = buildPaciente({
      id: 'p-3',
      nombre: 'Baja',
      etapaActivaId: 'etapa-3',
      state: PACIENTE_STATE.BAJA,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [activo, pausado, baja],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current.counts).toEqual({
      total: 3,
      activos: 1,
      conAlerta: 0,
    })
  })

  it('cuenta como activo a un paciente en estado activo con el tratamiento cerrado (sin etapa abierta) o sin iniciar', () => {
    const cerrado = buildPaciente({ id: 'p-4', nombre: 'Cerrado' })
    const sinIniciar = buildPaciente({
      id: 'p-5',
      nombre: 'Sofia',
      mesActual: null,
      etapaActivaId: 'etapa-sin-iniciar',
      sinIniciar: true,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [cerrado, sinIniciar],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current.counts).toEqual({
      total: 2,
      activos: 2,
      conAlerta: 0,
    })
  })

  it('returns every paciente when filter=todos', () => {
    const juan = buildPaciente({ id: 'p-1', nombre: 'Juan' })
    const maria = buildPaciente({ id: 'p-2', nombre: 'Maria' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [juan, maria],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current.pacientes).toEqual([juan, maria])
  })

  it('lista solo a los pacientes en estado activo cuando filter=activos, aunque el pausado tenga una etapa abierta', () => {
    const cerrado = buildPaciente({ id: 'p-1', nombre: 'Cerrado' })
    const pausado = buildPaciente({
      id: 'p-2',
      nombre: 'Pausado',
      mesActual: 2,
      etapaActivaId: 'etapa-2',
      state: PACIENTE_STATE.PAUSED,
    })
    const sinIniciar = buildPaciente({
      id: 'p-4',
      nombre: 'Sofia',
      mesActual: null,
      etapaActivaId: 'etapa-sin-iniciar',
      sinIniciar: true,
    })
    const baja = buildPaciente({
      id: 'p-5',
      nombre: 'Baja',
      state: PACIENTE_STATE.BAJA,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [cerrado, pausado, sinIniciar, baja],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setFilter('activos')
    })
    expect(result.current.pacientes).toEqual([cerrado, sinIniciar])
  })

  it('returns only pacientes with an active alerta when filter=alerta', () => {
    const juan = buildPaciente({ id: 'p-1', nombre: 'Juan' })
    const pedro = buildPaciente({ id: 'p-3', nombre: 'Pedro' })
    mockAlertas({ alertas: [buildAlerta({ pacienteId: 'p-3' })] })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [juan, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setFilter('alerta')
    })
    expect(result.current.pacientes).toEqual([{ ...pedro, tieneAlerta: true }])
  })

  it('counts each paciente once in conAlerta even when it has two alertas', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [
        buildPaciente({ id: 'p-1', nombre: 'Juan' }),
        buildPaciente({ id: 'p-3', nombre: 'Pedro' }),
      ],
      isLoading: false,
      error: null,
    })
    mockAlertas({
      alertas: [
        buildAlerta({ pacienteId: 'p-3', eventoRef: 'ev-1' }),
        buildAlerta({
          pacienteId: 'p-3',
          tipo: ALERTA_TIPO.EVAL_VENCIDA,
          eventoRef: 'ev-2',
        }),
      ],
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current.counts).toEqual({
      total: 2,
      activos: 2,
      conAlerta: 1,
    })
  })

  it('does not flag a paciente with low score when the motor has no alerta for it (already attended)', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [buildPaciente({ id: 'p-1', nombre: 'Juan', ultimoScore: 2 })],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current.counts.conAlerta).toBe(0)
  })

  it('does not block the list while the alertas are still loading — nobody is flagged yet', () => {
    const juan = buildPaciente({ id: 'p-1', nombre: 'Juan' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [juan],
      isLoading: false,
      error: null,
    })
    mockAlertas({ isLoading: true })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current).toEqual({
      ...baseResult,
      pacientes: [juan],
      counts: { total: 1, activos: 1, conAlerta: 0 },
    })
  })

  it('does not surface an error nor flag anyone when the alertas fetch fails', () => {
    const juan = buildPaciente({ id: 'p-1', nombre: 'Juan' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [juan],
      isLoading: false,
      error: null,
    })
    mockAlertas({ error: 'alertas caídas' })
    const { result } = renderHook(() => usePacientesViewModel())
    expect(result.current).toEqual({
      ...baseResult,
      pacientes: [juan],
      counts: { total: 1, activos: 1, conAlerta: 0 },
    })
  })

  it('filters by case-insensitive nombre substring', () => {
    const maria = buildPaciente({ id: 'p-2', nombre: 'Maria' })
    const pedro = buildPaciente({ id: 'p-3', nombre: 'Pedro' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [maria, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setSearchQuery('MARIA')
    })
    expect(result.current.pacientes).toEqual([maria])
  })

  it('filters with accent-insensitive matching when the nombre has accents', () => {
    const maria = buildPaciente({ id: 'p-2', nombre: 'María' })
    const pedro = buildPaciente({ id: 'p-3', nombre: 'Pedro' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [maria, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setSearchQuery('maria')
    })
    expect(result.current.pacientes).toEqual([maria])
  })

  it('filters with combined case+accent insensitive matching', () => {
    const cliente = buildPaciente({ id: 'p-2', nombre: 'Cliente' })
    const pedro = buildPaciente({ id: 'p-3', nombre: 'Pedro' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [cliente, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setSearchQuery('CLIENTE')
    })
    expect(result.current.pacientes).toEqual([cliente])
  })

  it('filters with accent-insensitive matching when the query has accents but the nombre does not', () => {
    const cliente = buildPaciente({ id: 'p-2', nombre: 'Cliente' })
    const pedro = buildPaciente({ id: 'p-3', nombre: 'Pedro' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [cliente, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setSearchQuery('Cliente')
    })
    expect(result.current.pacientes).toEqual([cliente])
  })

  it('applies search and filter together (AND)', () => {
    const juan = buildPaciente({
      id: 'p-1',
      nombre: 'Juan',
      mesActual: 1,
      etapaActivaId: 'etapa-1',
    })
    const maria = buildPaciente({ id: 'p-2', nombre: 'Maria' })
    const pedro = buildPaciente({
      id: 'p-3',
      nombre: 'Pedro',
      mesActual: 2,
      etapaActivaId: 'etapa-3',
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [juan, maria, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setFilter('activos')
      result.current.setSearchQuery('ped')
    })
    expect(result.current.pacientes).toEqual([pedro])
  })

  it('preserves counts when a filter is applied (counts come from unfiltered list)', () => {
    const juan = buildPaciente({
      id: 'p-1',
      nombre: 'Juan',
      mesActual: 1,
      etapaActivaId: 'etapa-1',
    })
    const maria = buildPaciente({ id: 'p-2', nombre: 'Maria' })
    const pedro = buildPaciente({
      id: 'p-3',
      nombre: 'Pedro',
      mesActual: 2,
      etapaActivaId: 'etapa-3',
    })
    mockAlertas({ alertas: [buildAlerta({ pacienteId: 'p-3' })] })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [juan, maria, pedro],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setFilter('alerta')
    })
    expect(result.current.counts).toEqual({
      total: 3,
      activos: 3,
      conAlerta: 1,
    })
  })

  it('reflects setFilter updates in the filter field', () => {
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setFilter('alerta')
    })
    expect(result.current.filter).toBe('alerta')
  })

  it('reflects setSearchQuery updates in the searchQuery field', () => {
    const { result } = renderHook(() => usePacientesViewModel())
    act(() => {
      result.current.setSearchQuery('hello')
    })
    expect(result.current.searchQuery).toBe('hello')
  })

  it('manda los pacientes pausados y dados de baja al fondo de la lista, sin alterar el resto del orden', () => {
    const baja = buildPaciente({
      id: 'p-1',
      nombre: 'Baja',
      state: PACIENTE_STATE.BAJA,
    })
    const activoUno = buildPaciente({ id: 'p-2', nombre: 'Activo uno' })
    const pausado = buildPaciente({
      id: 'p-3',
      nombre: 'Pausado',
      state: PACIENTE_STATE.PAUSED,
    })
    const activoDos = buildPaciente({ id: 'p-4', nombre: 'Activo dos' })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [baja, activoUno, pausado, activoDos],
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => usePacientesViewModel())

    expect(result.current.pacientes.map((p) => p.id)).toEqual([
      'p-2',
      'p-4',
      'p-1',
      'p-3',
    ])
  })
})
