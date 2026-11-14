import { act, renderHook } from '@testing-library/react'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import {
  useFetchTerapeutaById,
  useDeactivateTerapeuta,
  useReactivateTerapeuta,
} from '@/app/controllers/Terapeuta'
import type { Terapeuta } from '@/app/controllers/Terapeuta'
import { TERAPEUTA_STATE } from '@/app/controllers/Terapeuta'
import { useFetchPacientesByTerapeuta } from '@/app/controllers/Paciente'
import type { Paciente } from '@/app/controllers/Paciente'
import { PACIENTE_STATE } from '@/app/controllers/Paciente'
import { useFetchAlertasByTerapeuta } from '@/app/controllers/Alerta'
import type { Alerta } from '@/app/controllers/Alerta'
import { ALERTA_TIPO } from '@/app/controllers/Alerta'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTerapeutaDetailViewModel } from './useTerapeutaDetailViewModel'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))

jest.mock('@/app/controllers/Terapeuta', () => ({
  ...jest.requireActual('@/app/controllers/Terapeuta'),
  useFetchTerapeutaById: jest.fn(),
  useDeactivateTerapeuta: jest.fn(),
  useReactivateTerapeuta: jest.fn(),
  TERAPEUTA_STATE: {
    ACTIVO: 'activo',
    INACTIVO: 'inactivo',
    PENDIENTE: 'pendiente',
  },
}))

jest.mock('@/app/controllers/Paciente', () => ({
  ...jest.requireActual('@/app/controllers/Paciente'),
  useFetchPacientesByTerapeuta: jest.fn(),
  PACIENTE_STATE: { ACTIVE: 'active', PAUSED: 'paused', BAJA: 'baja' },
}))

jest.mock('@/app/controllers/Alerta', () => ({
  ...jest.requireActual('@/app/controllers/Alerta'),
  useFetchAlertasByTerapeuta: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

describe('useTerapeutaDetailViewModel', () => {
  let terapeutaFixture: Terapeuta
  let pacienteFixture: Paciente
  let alertaFixture: Alerta
  const refreshTerapeutaMock = jest.fn()
  const deactivateMutateMock = jest.fn()
  const reactivateMutateMock = jest.fn()
  const routerPushMock = jest.fn()

  const baseModalFields = {
    editarOpen: false,
    onOpenEditar: expect.any(Function),
    onCloseEditar: expect.any(Function),
    onEditarSuccess: expect.any(Function),
    desactivarTarget: null,
    desactivarMotivo: '',
    desactivarMotivoError: null,
    desactivarSubmitError: null,
    isDeactivating: false,
    onOpenDesactivar: expect.any(Function),
    onCloseDesactivar: expect.any(Function),
    onDesactivarMotivoChange: expect.any(Function),
    onConfirmDesactivar: expect.any(Function),
    onReactivar: expect.any(Function),
    onOpenPaciente: expect.any(Function),
    alertas: [],
    isLoadingAlertas: false,
    alertasError: null,
  }

  beforeEach(() => {
    terapeutaFixture = {
      id: 't-1',
      profile: {
        id: 'u-2',
        name: 'Dr. Ana',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 'ana@test.com',
      },
      role: ROLE.TERAPEUTA,
      state: TERAPEUTA_STATE.ACTIVO,
      email: 'ana@test.com',
      telefono: null,
      pacientesActivos: 1,
    }

    pacienteFixture = {
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
    }

    alertaFixture = {
      tipo: ALERTA_TIPO.SCORE_BAJO,
      prioridad: 'alta',
      pacienteId: 'p-1',
      pacienteNombre: 'Juan',
      terapeutaId: 't-1',
      terapeutaNombre: 'Dr. Ana',
      nombre: 'Score bajo',
      icono: '↘',
      mensaje: 'score 2 · última evaluación',
      eventoRef: 'nivel-1',
      fecha: '2026-07-01',
      descartable: true,
    }
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-1',
        name: 'Admin',
        role: ROLE.ADMIN,
        timezone: 'UTC',
        email: 'admin@test.com',
      },
      isLoading: false,
      error: null,
    })

    refreshTerapeutaMock.mockReset()
    ;(useFetchTerapeutaById as jest.Mock).mockReturnValue({
      terapeuta: terapeutaFixture,
      isLoading: false,
      error: null,
      refresh: refreshTerapeutaMock,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [pacienteFixture],
      isLoading: false,
      error: null,
    })
    ;(useFetchAlertasByTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      isLoading: false,
      error: null,
    })

    deactivateMutateMock.mockResolvedValue({ ok: true })
    ;(useDeactivateTerapeuta as jest.Mock).mockReturnValue({
      mutate: deactivateMutateMock,
      isLoading: false,
      error: null,
      errorCount: null,
    })

    reactivateMutateMock.mockResolvedValue({ ok: true })
    ;(useReactivateTerapeuta as jest.Mock).mockReturnValue({
      mutate: reactivateMutateMock,
      isLoading: false,
      error: null,
    })
    ;(useRouter as jest.Mock).mockReturnValue({ push: routerPushMock })
  })

  // --- Core data shapes ---

  it('returns terapeuta and pacientes in admin happy path', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current).toEqual({
      terapeuta: terapeutaFixture,
      pacientes: [pacienteFixture],
      isLoading: false,
      error: null,
      isAdmin: true,
      isResolvingRole: false,
      notFound: false,
      ...baseModalFields,
    })
  })

  it('returns empty pacientes array when terapeuta has no pacientes', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.pacientes).toEqual([])
  })

  it('returns notFound=true when terapeuta is null and not loading and no error', () => {
    ;(useFetchTerapeutaById as jest.Mock).mockReturnValue({
      terapeuta: null,
      isLoading: false,
      error: null,
      refresh: refreshTerapeutaMock,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-999'))
    expect(result.current.notFound).toBe(true)
  })

  it('propagates the terapeuta fetch error', () => {
    ;(useFetchTerapeutaById as jest.Mock).mockReturnValue({
      terapeuta: null,
      isLoading: false,
      error: 'fetch failed',
      refresh: refreshTerapeutaMock,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.error).toBe('fetch failed')
  })

  it('propagates the pacientes fetch error when terapeuta fetch has no error', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: 'pacientes error',
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.error).toBe('pacientes error')
  })

  // --- alertas (Task 2.3) ---

  it('exposes the alertas fetched by useFetchAlertasByTerapeuta', () => {
    ;(useFetchAlertasByTerapeuta as jest.Mock).mockReturnValue({
      alertas: [alertaFixture],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.alertas).toEqual([alertaFixture])
    expect(result.current.isLoadingAlertas).toBe(false)
    expect(result.current.alertasError).toBeNull()
  })

  it('calls useFetchAlertasByTerapeuta with the terapeutaId for an admin', () => {
    renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(useFetchAlertasByTerapeuta).toHaveBeenCalledWith('t-1')
  })

  it('null-guards useFetchAlertasByTerapeuta for a non-admin user', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-3',
        name: 'Terapeuta',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 't@test.com',
      },
      isLoading: false,
      error: null,
    })
    renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(useFetchAlertasByTerapeuta).toHaveBeenCalledWith(null)
  })

  it('propagates the alertas fetch error', () => {
    ;(useFetchAlertasByTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      isLoading: false,
      error: 'alertas error',
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.alertasError).toBe('alertas error')
  })

  it('reports isLoadingAlertas=true while the alertas fetch is loading', () => {
    ;(useFetchAlertasByTerapeuta as jest.Mock).mockReturnValue({
      alertas: [],
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.isLoadingAlertas).toBe(true)
  })

  it('returns terapeuta=null and pacientes=[] and notFound=false for non-admin user', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-3',
        name: 'Terapeuta',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 't@test.com',
      },
      isLoading: false,
      error: null,
    })
    ;(useFetchTerapeutaById as jest.Mock).mockReturnValue({
      terapeuta: null,
      isLoading: false,
      error: null,
      refresh: refreshTerapeutaMock,
    })
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current).toEqual(
      expect.objectContaining({
        terapeuta: null,
        pacientes: [],
        isAdmin: false,
        notFound: false,
      }),
    )
  })

  it('reports isLoading=true while terapeuta fetch is loading', () => {
    ;(useFetchTerapeutaById as jest.Mock).mockReturnValue({
      terapeuta: null,
      isLoading: true,
      error: null,
      refresh: refreshTerapeutaMock,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.isLoading).toBe(true)
  })

  it('reports isLoading=true while pacientes fetch is loading', () => {
    ;(useFetchPacientesByTerapeuta as jest.Mock).mockReturnValue({
      pacientes: [],
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.isLoading).toBe(true)
  })

  it('reports isLoading=true and isResolvingRole=true while profile is loading', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current).toEqual(
      expect.objectContaining({ isLoading: true, isResolvingRole: true }),
    )
  })

  // --- onOpenPaciente ---

  it('onOpenPaciente calls router.push with the paciente route', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenPaciente('p-42')
    })
    expect(routerPushMock).toHaveBeenCalledWith('/pacientes/p-42')
  })

  it('onOpenPaciente deep-links medicion_cierre_pendiente to ?finalizar=1', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenPaciente('p-42', {
        ...alertaFixture,
        tipo: ALERTA_TIPO.MEDICION_CIERRE_PENDIENTE,
      })
    })
    expect(routerPushMock).toHaveBeenCalledWith(
      '/pacientes/p-42/camino?finalizar=1',
    )
  })

  // --- editarOpen ---

  it('editarOpen starts as false', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    expect(result.current.editarOpen).toBe(false)
  })

  it('onOpenEditar sets editarOpen to true', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenEditar()
    })
    expect(result.current.editarOpen).toBe(true)
  })

  it('onCloseEditar sets editarOpen back to false', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenEditar()
    })
    act(() => {
      result.current.onCloseEditar()
    })
    expect(result.current.editarOpen).toBe(false)
  })

  it('onEditarSuccess calls toast.success with the given mensaje', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenEditar()
    })
    act(() => {
      result.current.onEditarSuccess('Terapeuta actualizado.')
    })
    expect(toast.success).toHaveBeenCalledWith('Terapeuta actualizado.')
  })

  it('onEditarSuccess closes editarOpen', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenEditar()
    })
    act(() => {
      result.current.onEditarSuccess('ok')
    })
    expect(result.current.editarOpen).toBe(false)
  })

  it('onEditarSuccess calls refreshTerapeuta', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenEditar()
    })
    act(() => {
      result.current.onEditarSuccess('ok')
    })
    expect(refreshTerapeutaMock).toHaveBeenCalledTimes(1)
  })

  // --- desactivar ---

  it('onOpenDesactivar sets desactivarTarget to the loaded terapeuta', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    expect(result.current.desactivarTarget).toEqual(terapeutaFixture)
  })

  it('onOpenDesactivar resets motivo and errors', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        desactivarMotivo: '',
        desactivarMotivoError: null,
        desactivarSubmitError: null,
      }),
    )
  })

  it('onCloseDesactivar clears desactivarTarget and motivo and errors', () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    act(() => {
      result.current.onDesactivarMotivoChange('algún motivo')
    })
    act(() => {
      result.current.onCloseDesactivar()
    })
    expect(result.current).toEqual(
      expect.objectContaining({
        desactivarTarget: null,
        desactivarMotivo: '',
        desactivarMotivoError: null,
        desactivarSubmitError: null,
      }),
    )
  })

  it('onConfirmDesactivar with empty motivo sets desactivarMotivoError and does not call mutate', async () => {
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarMotivoError).not.toBeNull()
    expect(deactivateMutateMock).not.toHaveBeenCalled()
  })

  it('onConfirmDesactivar on success calls toast.success, clears target, and calls refreshTerapeuta', async () => {
    deactivateMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(toast.success).toHaveBeenCalledWith('Terapeuta desactivado.')
    expect(result.current.desactivarTarget).toBeNull()
    expect(refreshTerapeutaMock).toHaveBeenCalledTimes(1)
  })

  it('onConfirmDesactivar with tiene_pacientes_activos sets submitError with count from the mutate result on the first attempt', async () => {
    // El hook sigue con error: null (closure del render anterior, como en el
    // navegador al primer intento): el código tiene que salir del result.
    deactivateMutateMock.mockResolvedValue({
      ok: false,
      error: 'tiene_pacientes_activos',
      errorCount: 3,
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarSubmitError).toBe(
      'Este terapeuta tiene 3 pacientes a cargo y no se puede desactivar mientras los tenga. Todavía no se pueden pasar a otro terapeuta desde el panel.',
    )
  })

  it('onConfirmDesactivar with no_puede_autodesactivarse sets correct submitError', async () => {
    deactivateMutateMock.mockResolvedValue({
      ok: false,
      error: 'no_puede_autodesactivarse',
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarSubmitError).toBe(
      'No podés desactivar tu propia cuenta.',
    )
  })

  it('onConfirmDesactivar with generic error sets generic submitError', async () => {
    deactivateMutateMock.mockResolvedValue({
      ok: false,
      error: 'deactivate_failed',
    })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    act(() => {
      result.current.onOpenDesactivar()
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarSubmitError).toBe(
      'No pudimos desactivar al terapeuta. Intentá de nuevo.',
    )
  })

  // --- onReactivar ---

  it('onReactivar on success calls toast.success and refreshTerapeuta', async () => {
    reactivateMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    await act(async () => {
      await result.current.onReactivar()
    })
    expect(toast.success).toHaveBeenCalledWith('Terapeuta reactivado.')
    expect(refreshTerapeutaMock).toHaveBeenCalledTimes(1)
  })

  it('onReactivar on failure calls toast.error', async () => {
    reactivateMutateMock.mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useTerapeutaDetailViewModel('t-1'))
    await act(async () => {
      await result.current.onReactivar()
    })
    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos reactivar al terapeuta.',
    )
  })
})
