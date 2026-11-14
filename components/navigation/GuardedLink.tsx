'use client'

import type { ComponentProps } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useNavigationGuard } from './NavigationGuardProvider'

// `next/link` que respeta el guard de navegación: con cambios sin guardar
// frena la navegación (`onNavigate` + `preventDefault`, la vía documentada por
// Next) y la retoma con `router.push` solo si el usuario confirma. Sin cambios
// pendientes se comporta exactamente como un `Link`.
//
// `href` es string a propósito: es lo que `router.push` necesita para retomar.
type GuardedLinkProps = Omit<
  ComponentProps<typeof Link>,
  'href' | 'onNavigate'
> & {
  href: string
}

const GuardedLink = ({ href, ...props }: GuardedLinkProps) => {
  const router = useRouter()
  const { hasUnsavedChanges, guardNavigation } = useNavigationGuard()

  return (
    <Link
      href={href}
      onNavigate={(e) => {
        if (!hasUnsavedChanges()) return
        e.preventDefault()
        guardNavigation(() => router.push(href))
      }}
      {...props}
    />
  )
}

export { GuardedLink }
export type { GuardedLinkProps }
