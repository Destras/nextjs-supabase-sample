import { act, renderHook } from '@testing-library/react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  useFetchPacienteById,
  useIniciarTratamiento,
  useReenviarBienvenida,
} from '@/app/controllers/Paciente'
import { useFetchPlanContenidoDelTratamientoActivo } from '@/app/controllers/Tratamiento'
import type { Paciente } from '@/app/controllers/Paciente'
import { useFetchAlertasTerapeuta } from '@/app/controllers/Alerta'
import type { Alerta } from '@/app/controllers/Alerta'
import { ALERTA_TIPO } from '@/app/controllers/Alerta'
import { useAlertasCountValue } from '@/components/alertas'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { usePacienteLayoutViewModel } from './usePacienteLayoutViewModel'

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('@/app/controllers/Paciente', () => ({
  ...jest.requireActual('@/app/controllers/Paciente'),
  useFetchPacienteById: jest.fn(),
  useIniciarTratamiento: jest.fn(),
  useReenviarBienvenida: jest.fn(),
}))

jest.mock('@/app/controllers/Alerta', () => ({
  ...jest.requireActual('@/app/controllers/Alerta'),
  useFetchAlertasTerapeuta: jest.fn(),
}))

jest.mock('@/app/controllers/Tratamiento', () => ({
  ...jest.requireActual('@/app/controllers/Tratamiento'),
  useFetchPlanContenidoDelTratamientoActivo: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/components/alertas', () => ({
  useAlertasCountValue: jest.fn(),
}))

const buildAlerta = (overrides: Partial<Alerta> = {}): Alerta => ({
  tipo: ALERTA_TIPO.MES_3,
  prioridad: 'media',
  pacienteId: 'p-1',
  pacienteNombre: 'Juan',
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

const buildPaciente = (overrides: Partial<Paciente> = {}): Paciente => ({
  id: 'p-1',
  nombre: 'Juan',
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

const baseResult = {
  paciente: null,
  isLoading: false,
  error: null,
  refetch: expect.any(Function),
  puedeIniciar: false,
  isIniciarOpen: false,
  setIniciarOpen: expect.any(Function),
  semanasConContenido: 0,
  totalSemanas: 0,
  aviso: 'bienvenida',
  onIniciar: expect.any(Function),
  isIniciando: false,
  bienvenidaPendiente: false,
  onReenviarBienvenida: expect.any(Function),
  isReenviando: false,
}

const mockPaciente = (paciente: Paciente, refetch = jest.fn()): void => {
  ;(useFetchPacienteById as jest.Mock).mockReturnValue({
    paciente,
    isLoading: false,
    error: null,
    refetch,
  })
}

describe('usePacienteLayoutViewModel', () => {
  beforeEach(() => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-1' })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockAlertas()
    ;(useIniciarTratamiento as jest.Mock).mockReturnValue({
      submit: jest.fn(),
      isSubmitting: false,
    })
    ;(useReenviarBienvenida as jest.Mock).mockReturnValue({
      reenviar: jest.fn(),
      isSending: false,
    })
    ;(useFetchPlanContenidoDelTratamientoActivo as jest.Mock).mockReturnValue({
      tratamiento: null,
      semanasTotales: null,
    })
    ;(toast.success as jest.Mock).mockClear()
    ;(toast.info as jest.Mock).mockClear()
    ;(toast.warning as jest.Mock).mockClear()
    ;(toast.error as jest.Mock).mockClear()
    ;(useAlertasCountValue as jest.Mock).mockReturnValue({
      count: 0,
      isLoading: false,
      error: null,
      adjust: jest.fn(),
      refetch: jest.fn(),
    })
  })

  it('flags tieneAlerta when the motor has an active alerta for this paciente', () => {
    const paciente = buildPaciente({ id: 'p-1' })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockAlertas({ alertas: [buildAlerta({ pacienteId: 'p-1' })] })
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual({
      ...baseResult,
      paciente: { ...paciente, tieneAlerta: true },
    })
  })

  it('does not flag tieneAlerta when the only alertas belong to other pacientes, even with low score', () => {
    const paciente = buildPaciente({ id: 'p-1', ultimoScore: 2 })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockAlertas({ alertas: [buildAlerta({ pacienteId: 'p-2' })] })
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual({ ...baseResult, paciente })
  })

  it('does not block the ficha while the alertas are loading — renders the paciente unflagged', () => {
    const paciente = buildPaciente({ id: 'p-1' })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockAlertas({ isLoading: true })
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual({ ...baseResult, paciente })
  })

  it('does not surface an error when the alertas fetch fails — paciente stays unflagged', () => {
    const paciente = buildPaciente({ id: 'p-1' })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    mockAlertas({ error: 'alertas caídas' })
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual({ ...baseResult, paciente })
  })

  it('returns isLoading true when the fetch is still loading', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual({ ...baseResult, isLoading: true })
  })

  it('returns paciente null with no error when fetch resolves empty', () => {
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual(baseResult)
  })

  it('forwards the error string when the fetch fails', () => {
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: 'boom',
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual({ ...baseResult, error: 'boom' })
  })

  it('returns the paciente when the fetch succeeds', () => {
    const paciente = buildPaciente({ nombre: 'Valentina' })
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    })
    const { result } = renderHook(() => usePacienteLayoutViewModel())
    expect(result.current).toEqual({ ...baseResult, paciente })
  })

  it('passes the pacienteId from useParams to the fetcher', () => {
    ;(useParams as jest.Mock).mockReturnValue({ id: 'p-42' })
    renderHook(() => usePacienteLayoutViewModel())
    expect(useFetchPacienteById).toHaveBeenCalledWith('p-42')
  })

  it('skips the fetch (passes null) when skip is true', () => {
    renderHook(() => usePacienteLayoutViewModel({ skip: true }))
    expect(useFetchPacienteById).toHaveBeenCalledWith(null)
  })

  it('refetch() recarga el paciente', () => {
    const refetchPaciente = jest.fn()
    ;(useFetchPacienteById as jest.Mock).mockReturnValue({
      paciente: null,
      isLoading: false,
      error: null,
      refetch: refetchPaciente,
    })
    const { result } = renderHook(() => usePacienteLayoutViewModel())

    act(() => result.current.refetch())

    expect(refetchPaciente).toHaveBeenCalledTimes(1)
  })

  it('refetch() también recarga las alertas — cerrar un tratamiento cambia la etiqueta de la ficha', () => {
    const refetchAlertas = jest.fn()
    mockAlertas({ refetch: refetchAlertas })
    const { result } = renderHook(() => usePacienteLayoutViewModel())

    act(() => result.current.refetch())

    expect(refetchAlertas).toHaveBeenCalledTimes(1)
  })

  it('refetch() también recarga el contador de la campana — cerrar no cambia de ruta', () => {
    const refetchCount = jest.fn()
    ;(useAlertasCountValue as jest.Mock).mockReturnValue({
      count: 0,
      isLoading: false,
      error: null,
      adjust: jest.fn(),
      refetch: refetchCount,
    })
    const { result } = renderHook(() => usePacienteLayoutViewModel())

    act(() => result.current.refetch())

    expect(refetchCount).toHaveBeenCalledTimes(1)
  })

  it('keeps the same refetch identity across renders', () => {
    const { result, rerender } = renderHook(() => usePacienteLayoutViewModel())
    const primero = result.current.refetch
    rerender()
    expect(result.current.refetch).toBe(primero)
  })

  describe('iniciar tratamiento', () => {
    const sinIniciar = () =>
      buildPaciente({ sinIniciar: true, etapaActivaId: 'e-1' })

    it('puedeIniciar es true con el tratamiento sin iniciar', () => {
      mockPaciente(sinIniciar())
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      expect(result.current.puedeIniciar).toBe(true)
    })

    it('puedeIniciar es false si el paciente está de baja', () => {
      mockPaciente({ ...sinIniciar(), state: PACIENTE_STATE.BAJA })
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      expect(result.current.puedeIniciar).toBe(false)
    })

    it('pide el plan solo mientras no arrancó', () => {
      mockPaciente(buildPaciente({ sinIniciar: false }))
      renderHook(() => usePacienteLayoutViewModel())
      expect(useFetchPlanContenidoDelTratamientoActivo).toHaveBeenCalledWith(
        null,
      )
    })

    it('pide el plan del paciente sin iniciar', () => {
      mockPaciente(sinIniciar())
      renderHook(() => usePacienteLayoutViewModel())
      expect(useFetchPlanContenidoDelTratamientoActivo).toHaveBeenCalledWith(
        'p-1',
      )
    })

    it('onIniciar manda la etapa activa sin plan en edición', async () => {
      const submit = jest.fn().mockResolvedValue({
        ok: true,
        error: null,
        iniciado: true,
        bienvenida: 'enviada',
      })
      ;(useIniciarTratamiento as jest.Mock).mockReturnValue({
        submit,
        isSubmitting: false,
      })
      mockPaciente(sinIniciar())
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      await act(() => result.current.onIniciar())
      expect(submit).toHaveBeenCalledWith({ etapaId: 'e-1', semanas: null })
    })

    it('onIniciar avisa con un toast de éxito', async () => {
      ;(useIniciarTratamiento as jest.Mock).mockReturnValue({
        submit: jest.fn().mockResolvedValue({
          ok: true,
          error: null,
          iniciado: true,
          bienvenida: 'enviada',
        }),
        isSubmitting: false,
      })
      mockPaciente(sinIniciar())
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      await act(() => result.current.onIniciar())
      expect(toast.success).toHaveBeenCalledWith('Tratamiento iniciado.')
    })

    it('onIniciar recarga la ficha y cierra el diálogo', async () => {
      const refetchPaciente = jest.fn()
      ;(useIniciarTratamiento as jest.Mock).mockReturnValue({
        submit: jest.fn().mockResolvedValue({
          ok: false,
          error: 'etapa_cerrada',
          iniciado: false,
          bienvenida: 'desconocida',
        }),
        isSubmitting: false,
      })
      mockPaciente(sinIniciar(), refetchPaciente)
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      act(() => result.current.setIniciarOpen(true))
      await act(() => result.current.onIniciar())
      expect(refetchPaciente).toHaveBeenCalledTimes(1)
    })

    it('onIniciar cierra el diálogo al terminar', async () => {
      ;(useIniciarTratamiento as jest.Mock).mockReturnValue({
        submit: jest.fn().mockResolvedValue({
          ok: true,
          error: null,
          iniciado: true,
          bienvenida: 'enviada',
        }),
        isSubmitting: false,
      })
      mockPaciente(sinIniciar())
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      act(() => result.current.setIniciarOpen(true))
      await act(() => result.current.onIniciar())
      expect(result.current.isIniciarOpen).toBe(false)
    })
  })

  describe('reenviar bienvenida', () => {
    const pendiente = () =>
      buildPaciente({ etapaActivaId: 'e-1', sinIniciar: false })

    it('bienvenidaPendiente refleja isBienvenidaPendiente', () => {
      mockPaciente(pendiente())
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      expect(result.current.bienvenidaPendiente).toBe(true)
    })

    it('onReenviarBienvenida manda al paciente y avisa', async () => {
      const reenviar = jest.fn().mockResolvedValue('enviada')
      ;(useReenviarBienvenida as jest.Mock).mockReturnValue({
        reenviar,
        isSending: false,
      })
      mockPaciente(pendiente())
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      await act(() => result.current.onReenviarBienvenida())
      expect(reenviar).toHaveBeenCalledWith('p-1')
    })

    it('onReenviarBienvenida muestra el toast del resultado', async () => {
      ;(useReenviarBienvenida as jest.Mock).mockReturnValue({
        reenviar: jest.fn().mockResolvedValue('innecesaria'),
        isSending: false,
      })
      mockPaciente(pendiente())
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      await act(() => result.current.onReenviarBienvenida())
      expect(toast.info).toHaveBeenCalledWith('No hizo falta: ya tiene la app.')
    })

    it('onReenviarBienvenida recarga la ficha', async () => {
      const refetchPaciente = jest.fn()
      ;(useReenviarBienvenida as jest.Mock).mockReturnValue({
        reenviar: jest.fn().mockResolvedValue('error'),
        isSending: false,
      })
      mockPaciente(pendiente(), refetchPaciente)
      const { result } = renderHook(() => usePacienteLayoutViewModel())
      await act(() => result.current.onReenviarBienvenida())
      expect(refetchPaciente).toHaveBeenCalledTimes(1)
    })
  })
})
