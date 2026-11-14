'use client'

import type { ReactNode } from 'react'
import { AlertasCountProvider } from '@/components/alertas'
import { NavigationGuardProvider } from './NavigationGuardProvider'
import { useSidebarViewModel } from './useSidebarViewModel'
import { SidebarNav } from './SidebarNav'
import { Topbar } from './Topbar'

interface SidebarLayoutProps {
  children: ReactNode
}

// El shell vive DENTRO del NavigationGuardProvider: useSidebarViewModel
// necesita el guard para que cerrar sesión pida confirmación.
const SidebarShell = ({ children }: SidebarLayoutProps) => {
  const {
    navigationSections,
    isAuthPage,
    profile,
    isProfileLoading,
    isExpulsando,
    onLogout,
  } = useSidebarViewModel()

  if (isAuthPage) {
    return <>{children}</>
  }

  // La sesión dejó de valer y ya se está yendo al login (BETA-045): no se
  // dibuja un panel vacío con errores de "no autenticado" en el camino.
  if (isExpulsando) {
    return null
  }

  return (
    <AlertasCountProvider>
      <SidebarNav
        navigationSections={navigationSections}
        profile={profile}
        isProfileLoading={isProfileLoading}
        onLogout={onLogout}
      />
      <div className="min-h-dvh pl-[260px]">
        <Topbar />
        {children}
      </div>
    </AlertasCountProvider>
  )
}

const SidebarLayout = ({ children }: SidebarLayoutProps) => (
  <NavigationGuardProvider>
    <SidebarShell>{children}</SidebarShell>
  </NavigationGuardProvider>
)

export { SidebarLayout }
export type { SidebarLayoutProps }
