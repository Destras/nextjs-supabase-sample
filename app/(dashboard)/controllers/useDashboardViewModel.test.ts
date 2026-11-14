import { act, renderHook } from '@testing-library/react'
import { useCurrentUserProfile, ROLE } from '@/app/controllers/Auth'
import { useDashboardViewModel } from './useDashboardViewModel'

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  ROLE: { ADMIN: 'admin', TERAPEUTA: 'terapeuta', PACIENTE: 'paciente' },
}))

describe('useDashboardViewModel', () => {
  beforeEach(() => {
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
  })

  it('authorizes an admin and exposes the admin role', () => {
    const { result } = renderHook(() => useDashboardViewModel())
    expect(result.current).toEqual({
      role: ROLE.ADMIN,
      isLoading: false,
      error: null,
      isAuthorized: true,
      puedeAlternarVista: true,
      vista: 'general',
      onVistaChange: expect.any(Function),
    })
  })

  it('authorizes a terapeuta and exposes the terapeuta role', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-2',
        name: 'Tera',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 'tera@test.com',
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useDashboardViewModel())
    expect(result.current).toEqual({
      role: ROLE.TERAPEUTA,
      isLoading: false,
      error: null,
      isAuthorized: true,
      puedeAlternarVista: false,
      vista: 'general',
      onVistaChange: expect.any(Function),
    })
  })

  it('does not authorize a paciente', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-3',
        name: 'Pac',
        role: ROLE.PACIENTE,
        timezone: 'UTC',
        email: 'pac@test.com',
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useDashboardViewModel())
    expect(result.current).toEqual({
      role: ROLE.PACIENTE,
      isLoading: false,
      error: null,
      isAuthorized: false,
      puedeAlternarVista: false,
      vista: 'general',
      onVistaChange: expect.any(Function),
    })
  })

  it('reports loading with a null role while the profile resolves', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useDashboardViewModel())
    expect(result.current).toEqual({
      role: null,
      isLoading: true,
      error: null,
      isAuthorized: false,
      puedeAlternarVista: false,
      vista: 'general',
      onVistaChange: expect.any(Function),
    })
  })

  it('does not authorize when the profile resolved but no role is present', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useDashboardViewModel())
    expect(result.current).toEqual({
      role: null,
      isLoading: false,
      error: null,
      isAuthorized: false,
      puedeAlternarVista: false,
      vista: 'general',
      onVistaChange: expect.any(Function),
    })
  })

  it('surfaces the profile error and does not authorize', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
      error: 'profile error',
    })
    const { result } = renderHook(() => useDashboardViewModel())
    expect(result.current).toEqual({
      role: null,
      isLoading: false,
      error: 'profile error',
      isAuthorized: false,
      puedeAlternarVista: false,
      vista: 'general',
      onVistaChange: expect.any(Function),
    })
  })

  it('allows an admin to switch vista to caseload via onVistaChange', () => {
    const { result } = renderHook(() => useDashboardViewModel())

    act(() => {
      result.current.onVistaChange('caseload')
    })

    expect(result.current.vista).toBe('caseload')
  })

  // FIX 3c: ToggleGroup emite un string crudo (incluido '' al deseleccionar).
  // onVistaChange valida contra los valores de DashboardVista e ignora
  // cualquier otra cosa — la View ya no necesita el cast/conditional.
  it('ignores an empty string from onVistaChange (ToggleGroup deselect)', () => {
    const { result } = renderHook(() => useDashboardViewModel())

    act(() => {
      result.current.onVistaChange('')
    })

    expect(result.current.vista).toBe('general')
  })

  it('ignores a value from onVistaChange that is not a valid DashboardVista', () => {
    const { result } = renderHook(() => useDashboardViewModel())

    act(() => {
      result.current.onVistaChange('not-a-real-vista')
    })

    expect(result.current.vista).toBe('general')
  })

  it('does not allow a terapeuta to alternar vista', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: {
        id: 'u-2',
        name: 'Tera',
        role: ROLE.TERAPEUTA,
        timezone: 'UTC',
        email: 'tera@test.com',
      },
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useDashboardViewModel())
    expect(result.current.puedeAlternarVista).toBe(false)
  })
})
