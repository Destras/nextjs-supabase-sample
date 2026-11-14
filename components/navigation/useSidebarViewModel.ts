'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  LayoutDashboard,
  Library,
  SendHorizonal,
  Users,
  UserCog,
  UserPlus,
} from 'lucide-react'
import type { ElementType } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/app/controllers/Auth'
import {
  useCurrentUserProfile,
  useExpulsarSesionInvalida,
  ROLE,
} from '@/app/controllers/Auth'
import { useNavigationGuard } from './NavigationGuardProvider'

interface NavItem {
  label: string
  href: string
  icon: ElementType
  isActive: boolean
  requiredRole?: ROLE
  allowedRoles?: ROLE[]
}

interface NavSection {
  label: string
  items: NavItem[]
}

interface SidebarViewModel {
  navigationSections: NavSection[]
  isAuthPage: boolean
  profile: Profile | null
  isProfileLoading: boolean
  // La sesión dejó de valer y se está yendo al login (BETA-045): el shell no
  // dibuja el panel mientras tanto.
  isExpulsando: boolean
  onLogout: () => void
}

const useSidebarViewModel = (): SidebarViewModel => {
  const pathname = usePathname()
  const router = useRouter()
  const { profile, isLoading: isProfileLoading } = useCurrentUserProfile()
  const isAuthPage = pathname.startsWith('/auth')
  const { expulsando: isExpulsando } = useExpulsarSesionInvalida({
    activo: !isAuthPage,
    pathname,
  })

  const { guardNavigation } = useNavigationGuard()

  // Cerrar sesión también es salir de la pantalla: con cambios sin guardar
  // pide la misma confirmación que el resto del shell (BETA-006).
  const onLogout = (): void => {
    guardNavigation(() => {
      void (async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/auth/login')
      })()
    })
  }

  const allItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      isActive: pathname === '/',
    },
    {
      label: 'Mis pacientes',
      href: '/pacientes',
      icon: Users,
      isActive:
        pathname.startsWith('/pacientes') && pathname !== '/pacientes/nuevo',
    },
    {
      label: 'Alertas',
      href: '/alertas',
      icon: Bell,
      isActive: pathname.startsWith('/alertas'),
      allowedRoles: [ROLE.TERAPEUTA, ROLE.ADMIN],
    },
    {
      label: 'Nuevo paciente',
      href: '/pacientes/nuevo',
      icon: UserPlus,
      isActive: pathname === '/pacientes/nuevo',
    },
    {
      label: 'Contenido',
      href: '/contenido',
      icon: Library,
      isActive: pathname.startsWith('/contenido'),
    },
    {
      label: 'Asignar contenido',
      href: '/asignar-contenido',
      icon: SendHorizonal,
      isActive: pathname.startsWith('/asignar-contenido'),
      allowedRoles: [ROLE.TERAPEUTA, ROLE.ADMIN],
    },
    {
      label: 'Terapeutas',
      href: '/terapeutas',
      icon: UserCog,
      isActive: pathname.startsWith('/terapeutas'),
      requiredRole: ROLE.ADMIN,
    },
  ]

  // Gate role items on the resolved profile, NOT on isProfileLoading. The
  // profile hook keeps the last profile populated during a refetch (it only
  // toggles isLoading), so gating on loading would flicker role-gated items out
  // on every revalidation (CON-008). While the role is still unknown (profile
  // null on initial load) the role checks below naturally fail → items hidden.
  const visibleItems = allItems.filter((it) => {
    if (it.requiredRole) {
      return profile?.role === it.requiredRole
    }
    if (it.allowedRoles) {
      return !!profile && it.allowedRoles.includes(profile.role)
    }
    return true
  })

  const navigationSections: NavSection[] = [
    {
      label: 'General',
      items: visibleItems,
    },
  ]

  return {
    navigationSections,
    isAuthPage,
    profile,
    isProfileLoading,
    isExpulsando,
    onLogout,
  }
}

export { useSidebarViewModel }
export type { SidebarViewModel, NavSection, NavItem }
