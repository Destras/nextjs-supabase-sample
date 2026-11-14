import { act, renderHook } from '@testing-library/react'
import { useCurrentUserProfile } from '@/app/controllers/Auth'
import { ROLE } from '@/app/controllers/Auth'
import {
  useFetchAllTerapeutas,
  useRevokeInvitation,
  useResendInvitation,
  useDeactivateTerapeuta,
  useReactivateTerapeuta,
} from '@/app/controllers/Terapeuta'
import type { Terapeuta } from '@/app/controllers/Terapeuta'
import { TERAPEUTA_STATE } from '@/app/controllers/Terapeuta'
import { toast } from 'sonner'
import { useTerapeutasViewModel } from './useTerapeutasViewModel'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))

jest.mock('@/app/controllers/Terapeuta', () => ({
  ...jest.requireActual('@/app/controllers/Terapeuta'),
  useFetchAllTerapeutas: jest.fn(),
  useRevokeInvitation: jest.fn(),
  useResendInvitation: jest.fn(),
  useDeactivateTerapeuta: jest.fn(),
  useReactivateTerapeuta: jest.fn(),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

describe('useTerapeutasViewModel', () => {
  let terapeutaFixture: Terapeuta
  const refreshMock = jest.fn()
  const revokeMutateMock = jest.fn()
  const resendMutateMock = jest.fn()
  const deactivateMutateMock = jest.fn()
  const reactivateMutateMock = jest.fn()

  const baseModalFields = {
    isInvitarOpen: false,
    onOpenInvitar: expect.any(Function),
    onCloseInvitar: expect.any(Function),
    onInvitarSuccess: expect.any(Function),
    revocarTarget: null,
    isRevoking: false,
    revokeError: null,
    onOpenRevocar: expect.any(Function),
    onCloseRevocar: expect.any(Function),
    onConfirmRevocar: expect.any(Function),
    onResendInvitation: expect.any(Function),
    editarTarget: null,
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
      pacientesActivos: 0,
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
    ;(useFetchAllTerapeutas as jest.Mock).mockReturnValue({
      terapeutas: [],
      isLoading: false,
      error: null,
      refresh: refreshMock,
    })
    revokeMutateMock.mockResolvedValue({ ok: true })
    ;(useRevokeInvitation as jest.Mock).mockReturnValue({
      mutate: revokeMutateMock,
      isLoading: false,
      error: null,
    })
    resendMutateMock.mockResolvedValue({ ok: true })
    ;(useResendInvitation as jest.Mock).mockReturnValue({
      mutate: resendMutateMock,
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
  })

  it('returns terapeutas when admin and fetch resolves with items', () => {
    ;(useFetchAllTerapeutas as jest.Mock).mockReturnValue({
      terapeutas: [terapeutaFixture],
      isLoading: false,
      error: null,
      refresh: refreshMock,
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current).toEqual({
      terapeutas: [terapeutaFixture],
      isLoading: false,
      error: null,
      isAdmin: true,
      isResolvingRole: false,
      ...baseModalFields,
    })
  })

  it('reports isLoading true and empty terapeutas when admin and fetch is loading', () => {
    ;(useFetchAllTerapeutas as jest.Mock).mockReturnValue({
      terapeutas: [],
      isLoading: true,
      error: null,
      refresh: refreshMock,
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current).toEqual({
      terapeutas: [],
      isLoading: true,
      error: null,
      isAdmin: true,
      isResolvingRole: false,
      ...baseModalFields,
    })
  })

  it('surfaces the fetch error when admin and fetch fails', () => {
    ;(useFetchAllTerapeutas as jest.Mock).mockReturnValue({
      terapeutas: [],
      isLoading: false,
      error: 'fetch error',
      refresh: refreshMock,
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current).toEqual({
      terapeutas: [],
      isLoading: false,
      error: 'fetch error',
      isAdmin: true,
      isResolvingRole: false,
      ...baseModalFields,
    })
  })

  it('returns empty terapeutas and no error when user is a non-admin terapeuta', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-3',
        name: 'Terapeuta',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 'terapeuta@test.com',
      },
      isLoading: false,
      error: null,
    })
    ;(useFetchAllTerapeutas as jest.Mock).mockReturnValue({
      terapeutas: [],
      isLoading: false,
      error: 'no_autorizado',
      refresh: refreshMock,
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current).toEqual({
      terapeutas: [],
      isLoading: false,
      error: null,
      isAdmin: false,
      isResolvingRole: false,
      ...baseModalFields,
    })
  })

  it('reports isLoading and isResolvingRole true while the profile is loading', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current).toEqual({
      terapeutas: [],
      isLoading: true,
      error: null,
      isAdmin: false,
      isResolvingRole: true,
      ...baseModalFields,
    })
  })

  it('surfaces the profile error when useCurrentUserProfile fails', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
      error: 'profile error',
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current).toEqual({
      terapeutas: [],
      isLoading: false,
      error: 'profile error',
      isAdmin: false,
      isResolvingRole: false,
      ...baseModalFields,
    })
  })

  it('isInvitarOpen starts as false', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current.isInvitarOpen).toBe(false)
  })

  it('onOpenInvitar sets isInvitarOpen to true', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenInvitar()
    })
    expect(result.current.isInvitarOpen).toBe(true)
  })

  it('onCloseInvitar sets isInvitarOpen back to false after opening', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenInvitar()
    })
    act(() => {
      result.current.onCloseInvitar()
    })
    expect(result.current.isInvitarOpen).toBe(false)
  })

  it('onInvitarSuccess closes the modal and calls refresh()', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenInvitar()
    })
    act(() => {
      result.current.onInvitarSuccess('Invitación enviada a test@test.com.')
    })
    expect(result.current.isInvitarOpen).toBe(false)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('onOpenRevocar sets revocarTarget to the given terapeuta', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenRevocar(terapeutaFixture)
    })
    expect(result.current.revocarTarget).toEqual(terapeutaFixture)
  })

  it('onConfirmRevocar on success calls toast.success, clears revocarTarget, and refreshes', async () => {
    revokeMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenRevocar(terapeutaFixture)
    })
    await act(async () => {
      await result.current.onConfirmRevocar()
    })
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('onConfirmRevocar on success sets revocarTarget to null and calls refresh', async () => {
    revokeMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenRevocar(terapeutaFixture)
    })
    await act(async () => {
      await result.current.onConfirmRevocar()
    })
    expect(result.current.revocarTarget).toBeNull()
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('onConfirmRevocar on failure sets revokeError and keeps revocarTarget', async () => {
    revokeMutateMock.mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenRevocar(terapeutaFixture)
    })
    await act(async () => {
      await result.current.onConfirmRevocar()
    })
    expect(result.current.revokeError).not.toBeNull()
    expect(result.current.revocarTarget).toEqual(terapeutaFixture)
  })

  it('onResendInvitation on success calls toast.success', async () => {
    resendMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTerapeutasViewModel())
    await act(async () => {
      await result.current.onResendInvitation(terapeutaFixture)
    })
    expect(toast.success).toHaveBeenCalledTimes(1)
  })

  it('onResendInvitation on failure calls toast.error', async () => {
    resendMutateMock.mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useTerapeutasViewModel())
    await act(async () => {
      await result.current.onResendInvitation(terapeutaFixture)
    })
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it('editarTarget starts as null', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    expect(result.current.editarTarget).toBeNull()
  })

  it('onOpenEditar sets editarTarget to the given terapeuta', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenEditar(terapeutaFixture)
    })
    expect(result.current.editarTarget).toEqual(terapeutaFixture)
  })

  it('onCloseEditar sets editarTarget back to null', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenEditar(terapeutaFixture)
    })
    act(() => {
      result.current.onCloseEditar()
    })
    expect(result.current.editarTarget).toBeNull()
  })

  it('onEditarSuccess calls toast.success with the given mensaje', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenEditar(terapeutaFixture)
    })
    act(() => {
      result.current.onEditarSuccess('Terapeuta actualizado.')
    })
    expect(toast.success).toHaveBeenCalledWith('Terapeuta actualizado.')
  })

  it('onEditarSuccess sets editarTarget to null', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenEditar(terapeutaFixture)
    })
    act(() => {
      result.current.onEditarSuccess('Terapeuta actualizado.')
    })
    expect(result.current.editarTarget).toBeNull()
  })

  it('onEditarSuccess calls refresh()', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenEditar(terapeutaFixture)
    })
    act(() => {
      result.current.onEditarSuccess('Terapeuta actualizado.')
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  // --- desactivar / reactivar ---

  it('onOpenDesactivar sets desactivarTarget and resets motivo and errors', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenDesactivar(terapeutaFixture)
    })
    expect(result.current.desactivarTarget).toEqual(terapeutaFixture)
    expect(result.current.desactivarMotivo).toBe('')
    expect(result.current.desactivarMotivoError).toBeNull()
    expect(result.current.desactivarSubmitError).toBeNull()
  })

  it('onCloseDesactivar clears desactivarTarget, motivo, and errors', () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenDesactivar(terapeutaFixture)
    })
    act(() => {
      result.current.onDesactivarMotivoChange('algún motivo')
    })
    act(() => {
      result.current.onCloseDesactivar()
    })
    expect(result.current.desactivarTarget).toBeNull()
    expect(result.current.desactivarMotivo).toBe('')
    expect(result.current.desactivarMotivoError).toBeNull()
    expect(result.current.desactivarSubmitError).toBeNull()
  })

  it('onConfirmDesactivar with empty motivo sets desactivarMotivoError and does not call mutate', async () => {
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenDesactivar(terapeutaFixture)
    })
    // motivo is '' — do NOT set it
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarMotivoError).not.toBeNull()
    expect(deactivateMutateMock).not.toHaveBeenCalled()
  })

  it('onConfirmDesactivar on success calls toast.success, clears target, and refreshes', async () => {
    deactivateMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenDesactivar(terapeutaFixture)
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Terapeuta se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(toast.success).toHaveBeenCalledWith('Terapeuta desactivado.')
    expect(result.current.desactivarTarget).toBeNull()
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('onConfirmDesactivar with tiene_pacientes_activos error sets submitError with patient count from result', async () => {
    deactivateMutateMock.mockResolvedValue({
      ok: false,
      error: 'tiene_pacientes_activos',
      errorCount: 3,
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenDesactivar(terapeutaFixture)
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Terapeuta se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarSubmitError).toBe(
      'Este terapeuta tiene 3 pacientes a cargo y no se puede desactivar mientras los tenga. Todavía no se pueden pasar a otro terapeuta desde el panel.',
    )
    // Dialog must stay open on error (target preserved)
    expect(result.current.desactivarTarget).toEqual(terapeutaFixture)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('onConfirmDesactivar with no_puede_autodesactivarse error sets correct submitError from result', async () => {
    deactivateMutateMock.mockResolvedValue({
      ok: false,
      error: 'no_puede_autodesactivarse',
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenDesactivar(terapeutaFixture)
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Terapeuta se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarSubmitError).toBe(
      'No podés desactivar tu propia cuenta.',
    )
    // Dialog must stay open on error
    expect(result.current.desactivarTarget).toEqual(terapeutaFixture)
    expect(result.current.desactivarMotivo).toBe('Terapeuta se fue.')
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('onConfirmDesactivar with unknown error code sets generic submitError and keeps dialog open', async () => {
    deactivateMutateMock.mockResolvedValue({
      ok: false,
      error: 'some_unknown_error',
    })
    const { result } = renderHook(() => useTerapeutasViewModel())
    act(() => {
      result.current.onOpenDesactivar(terapeutaFixture)
    })
    act(() => {
      result.current.onDesactivarMotivoChange('Terapeuta se fue.')
    })
    await act(async () => {
      await result.current.onConfirmDesactivar()
    })
    expect(result.current.desactivarSubmitError).toBe(
      'No pudimos desactivar al terapeuta. Intentá de nuevo.',
    )
    expect(result.current.desactivarTarget).toEqual(terapeutaFixture)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('onReactivar on success calls toast.success and refresh', async () => {
    reactivateMutateMock.mockResolvedValue({ ok: true })
    const { result } = renderHook(() => useTerapeutasViewModel())
    await act(async () => {
      await result.current.onReactivar(terapeutaFixture)
    })
    expect(toast.success).toHaveBeenCalledWith('Terapeuta reactivado.')
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('onReactivar on failure calls toast.error', async () => {
    reactivateMutateMock.mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useTerapeutasViewModel())
    await act(async () => {
      await result.current.onReactivar(terapeutaFixture)
    })
    expect(toast.error).toHaveBeenCalledWith(
      'No pudimos reactivar al terapeuta.',
    )
  })
})
