import { act, renderHook, screen } from '@testing-library/react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  useCurrentUserProfile,
  useExpulsarSesionInvalida,
} from '@/app/controllers/Auth'
import { ROLE } from '@/app/controllers/Auth'
import type { Profile } from '@/app/controllers/Auth'
import {
  NavigationGuardProvider,
  useUnsavedChangesGuard,
} from './NavigationGuardProvider'
import { useSidebarViewModel } from './useSidebarViewModel'
import type { SidebarViewModel } from './useSidebarViewModel'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}))

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    auth: { signOut: jest.fn() },
  })),
}))

jest.mock('@/app/controllers/Auth', () => ({
  useCurrentUserProfile: jest.fn(),
  useExpulsarSesionInvalida: jest.fn(() => ({ expulsando: false })),
  ROLE: {
    ADMIN: 'admin',
    TERAPEUTA: 'terapeuta',
    PACIENTE: 'paciente',
  },
}))

describe('useSidebarViewModel — role-based item filtering', () => {
  let adminProfile: Profile
  let terapeutaProfile: Profile

  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue('/dashboard')
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })

    adminProfile = {
      id: 'u-admin',
      name: 'Admin User',
      role: ROLE.ADMIN,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'admin@example.com',
    }

    terapeutaProfile = {
      id: 'u-terapeuta',
      name: 'Terapeuta User',
      role: ROLE.TERAPEUTA,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'terapeuta@example.com',
    }
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: adminProfile,
      isLoading: false,
      error: null,
    })
  })

  it("exposes a single 'General' section containing all items", () => {
    const { result } = renderHook(() => useSidebarViewModel())
    expect(result.current.navigationSections).toHaveLength(1)
    expect(result.current.navigationSections[0].label).toBe('General')
  })

  it('returns Dashboard regardless of profile role', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).toContain('Dashboard')
  })

  it('returns Terapeutas item when profile role is ADMIN', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: adminProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).toContain('Terapeutas')
  })

  it('hides Terapeutas item when profile role is TERAPEUTA', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).not.toContain('Terapeutas')
  })

  it('hides Terapeutas item when profile is still loading', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).not.toContain('Terapeutas')
  })

  it('hides Terapeutas item when profile is null', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).not.toContain('Terapeutas')
  })

  it('returns the full admin item list with Mis pacientes, Nuevo paciente, Contenido, Asignar contenido and Terapeutas when role is ADMIN', () => {
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).toEqual([
      'Dashboard',
      'Mis pacientes',
      'Alertas',
      'Nuevo paciente',
      'Contenido',
      'Asignar contenido',
      'Terapeutas',
    ])
  })

  it('returns the trimmed terapeuta item list (no Terapeutas) when role is TERAPEUTA', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).toEqual([
      'Dashboard',
      'Mis pacientes',
      'Alertas',
      'Nuevo paciente',
      'Contenido',
      'Asignar contenido',
    ])
  })

  it('returns the loading item list (no role-gated items) while profile resolves', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).toEqual(['Dashboard', 'Mis pacientes', 'Nuevo paciente', 'Contenido'])
  })

  it('hides Asignar contenido for paciente role', () => {
    const pacienteProfile: Profile = {
      id: 'u-paciente',
      name: 'Paciente User',
      role: ROLE.PACIENTE,
      timezone: 'America/Argentina/Buenos_Aires',
      email: 'paciente@example.com',
    }
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: pacienteProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).not.toContain('Asignar contenido')
  })

  it('shows Asignar contenido for terapeuta role', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).toContain('Asignar contenido')
  })

  it('shows Asignar contenido for admin role', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: adminProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).toContain('Asignar contenido')
  })

  it('hides Asignar contenido when profile is loading', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(
      result.current.navigationSections[0].items.map((it) => it.label),
    ).not.toContain('Asignar contenido')
  })

  it('keeps role-gated items visible during a profile refetch (profile present, isLoading true)', () => {
    // Refetch/revalidation: the role is already known (profile present) but the
    // hook re-enters loading. Items must NOT flicker out (CON-008).
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: adminProfile,
      isLoading: true,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    const labels = result.current.navigationSections[0].items.map(
      (it) => it.label,
    )
    expect(labels).toContain('Terapeutas')
    expect(labels).toContain('Asignar contenido')
  })

  it('marks only Nuevo paciente as active when pathname is /pacientes/nuevo', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/pacientes/nuevo')
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    const items = result.current.navigationSections[0].items
    const misPacientes = items.find((it) => it.label === 'Mis pacientes')
    const nuevo = items.find((it) => it.label === 'Nuevo paciente')
    expect(nuevo?.isActive).toBe(true)
    expect(misPacientes?.isActive).toBe(false)
  })

  it('marks only Mis pacientes as active when pathname is /pacientes (listing)', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/pacientes')
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    const items = result.current.navigationSections[0].items
    const misPacientes = items.find((it) => it.label === 'Mis pacientes')
    const nuevo = items.find((it) => it.label === 'Nuevo paciente')
    expect(misPacientes?.isActive).toBe(true)
    expect(nuevo?.isActive).toBe(false)
  })

  it('marks only Mis pacientes as active on a paciente detail page', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/pacientes/abc-123')
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    const items = result.current.navigationSections[0].items
    const misPacientes = items.find((it) => it.label === 'Mis pacientes')
    const nuevo = items.find((it) => it.label === 'Nuevo paciente')
    expect(misPacientes?.isActive).toBe(true)
    expect(nuevo?.isActive).toBe(false)
  })

  it('points Nuevo paciente to /pacientes/nuevo', () => {
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: terapeutaProfile,
      isLoading: false,
      error: null,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    const nuevo = result.current.navigationSections[0].items.find(
      (it) => it.label === 'Nuevo paciente',
    )
    expect(nuevo?.href).toBe('/pacientes/nuevo')
  })
})

interface ShellProps {
  isDirty: boolean
}

// El shell junto a una pantalla que declara (o no) cambios sin guardar.
const useShellWithScreen = ({ isDirty }: ShellProps): SidebarViewModel => {
  useUnsavedChangesGuard(isDirty)
  return useSidebarViewModel()
}

describe('useSidebarViewModel — onLogout', () => {
  let signOut: jest.Mock
  let push: jest.Mock

  beforeEach(() => {
    signOut = jest.fn().mockResolvedValue({ error: null })
    push = jest.fn()
    ;(createClient as jest.Mock).mockReturnValue({ auth: { signOut } })
    ;(usePathname as jest.Mock).mockReturnValue('/asignar-contenido')
    ;(useRouter as jest.Mock).mockReturnValue({ push })
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
    })
  })

  it('signs out right away when there are no unsaved changes', async () => {
    const { result } = renderHook(useShellWithScreen, {
      wrapper: NavigationGuardProvider,
      initialProps: { isDirty: false },
    })
    await act(async () => {
      result.current.onLogout()
    })
    expect(signOut).toHaveBeenCalledTimes(1)
  })

  it('goes to the login page after signing out', async () => {
    const { result } = renderHook(useShellWithScreen, {
      wrapper: NavigationGuardProvider,
      initialProps: { isDirty: false },
    })
    await act(async () => {
      result.current.onLogout()
    })
    expect(push).toHaveBeenCalledWith('/auth/login')
  })

  it('does not sign out while there are unsaved changes', async () => {
    const { result } = renderHook(useShellWithScreen, {
      wrapper: NavigationGuardProvider,
      initialProps: { isDirty: true },
    })
    await act(async () => {
      result.current.onLogout()
    })
    expect(signOut).not.toHaveBeenCalled()
  })

  it('asks for confirmation before signing out with unsaved changes', async () => {
    const { result } = renderHook(useShellWithScreen, {
      wrapper: NavigationGuardProvider,
      initialProps: { isDirty: true },
    })
    await act(async () => {
      result.current.onLogout()
    })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })
})

describe('useSidebarViewModel — sesión que dejó de valer (BETA-045)', () => {
  beforeEach(() => {
    ;(usePathname as jest.Mock).mockReturnValue('/pacientes')
    ;(useRouter as jest.Mock).mockReturnValue({ push: jest.fn() })
    ;(useCurrentUserProfile as jest.Mock).mockReturnValue({
      profile: null,
      isLoading: false,
      error: null,
    })
    ;(useExpulsarSesionInvalida as jest.Mock).mockReturnValue({
      expulsando: false,
    })
  })

  it('vigila la sesión en las pantallas del panel', () => {
    renderHook(() => useSidebarViewModel())
    expect(useExpulsarSesionInvalida).toHaveBeenCalledWith({
      activo: true,
      pathname: '/pacientes',
    })
  })

  it('no vigila la sesión en las pantallas de auth', () => {
    ;(usePathname as jest.Mock).mockReturnValue('/auth/login')
    renderHook(() => useSidebarViewModel())
    expect(useExpulsarSesionInvalida).toHaveBeenCalledWith({
      activo: false,
      pathname: '/auth/login',
    })
  })

  it('no oculta el panel mientras la sesión vale', () => {
    const { result } = renderHook(() => useSidebarViewModel())
    expect(result.current.isExpulsando).toBe(false)
  })

  it('avisa al shell que está expulsando', () => {
    ;(useExpulsarSesionInvalida as jest.Mock).mockReturnValue({
      expulsando: true,
    })
    const { result } = renderHook(() => useSidebarViewModel())
    expect(result.current.isExpulsando).toBe(true)
  })
})
