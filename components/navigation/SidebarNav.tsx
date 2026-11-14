'use client'

import Image from 'next/image'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/user-avatar'
import { Badge } from '@/components/ui/badge'
import { useAlertasCountValue } from '@/components/alertas'
import type { Profile } from '@/app/controllers/Auth'
import type { NavSection } from './useSidebarViewModel'
import { GuardedLink } from './GuardedLink'

interface SidebarNavProps {
  navigationSections: NavSection[]
  profile: Profile | null
  isProfileLoading: boolean
  onLogout: () => void
}

const SidebarNav = ({
  navigationSections,
  profile,
  isProfileLoading,
  onLogout,
}: SidebarNavProps) => {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const {
    count: alertasCount,
    isLoading: isAlertasCountLoading,
    error: alertasCountError,
  } = useAlertasCountValue()
  const showAlertasBadge =
    !isAlertasCountLoading && !alertasCountError && alertasCount > 0

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  const onToggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark')
  }

  const firstName = profile?.name.trim().split(/\s+/)[0] ?? ''

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-dvh w-[260px] flex-col border-r border-border bg-card pt-5"
      aria-label="Navegación principal"
    >
      {/* Brand */}
      <div className="border-b border-border px-5 pb-6">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo-mark.svg"
            alt=""
            aria-hidden
            width={28}
            height={28}
            unoptimized
            className="flex-shrink-0"
          />
          <div className="min-w-0">
            <p
              className="truncate text-[22px] font-normal leading-tight tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
            >
              Aurora
            </p>
            <p className="text-xs text-muted-foreground">Gestión Clínica</p>
          </div>
        </div>
      </div>

      {/* Role pill */}
      <div className="mx-5 mb-2 mt-4">
        {isProfileLoading ? (
          <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
        ) : profile ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1.5">
            <span className="block h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="eyebrow-sm text-muted-foreground">
              {firstName ? `${profile.role} · ${firstName}` : profile.role}
            </span>
          </div>
        ) : null}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 pb-1 pt-3">
        {navigationSections.map((section) => (
          <div key={section.label} className="mb-4 last:mb-0">
            <p className="eyebrow-sm mb-1.5 px-2.5 text-muted-foreground">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.href} className="relative">
                    {item.isActive && (
                      <span
                        className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-r bg-primary dark:bg-brand-accent-500"
                        aria-hidden
                      />
                    )}
                    <GuardedLink
                      href={item.href}
                      aria-current={item.isActive ? 'page' : undefined}
                      className={[
                        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors duration-150',
                        item.isActive
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                      ].join(' ')}
                    >
                      <Icon
                        size={16}
                        className="flex-shrink-0 opacity-70"
                        aria-hidden
                      />
                      {item.label}
                      {item.href === '/alertas' && showAlertasBadge && (
                        <Badge
                          variant="destructive"
                          className="ml-auto h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
                        >
                          {alertasCount}
                        </Badge>
                      )}
                    </GuardedLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card with dropdown — logout/theme stay reachable even when the profile fails to resolve */}
      <div className="border-t border-border px-5 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md p-1 text-left transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Abrir menú de usuario"
            >
              {isProfileLoading ? (
                <>
                  <span
                    className="h-8 w-8 flex-shrink-0 animate-pulse rounded-full bg-muted"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="block h-3 w-24 animate-pulse rounded bg-muted" />
                    <span className="block h-2 w-20 animate-pulse rounded bg-muted" />
                  </span>
                </>
              ) : profile ? (
                <>
                  <UserAvatar name={profile.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {profile.name || 'Usuario'}
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {profile.email}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
                    aria-hidden
                  >
                    ·
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-muted-foreground">
                      Sesión sin perfil
                    </span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      Cerrá sesión y volvé a entrar
                    </span>
                  </span>
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuItem onClick={onToggleTheme}>
              {mounted && isDark ? (
                <Sun size={14} className="mr-2" aria-hidden />
              ) : (
                <Moon size={14} className="mr-2" aria-hidden />
              )}
              {mounted
                ? isDark
                  ? 'Cambiar a tema claro'
                  : 'Cambiar a tema oscuro'
                : 'Cambiar tema'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onLogout}
              className="text-destructive focus:bg-destructive-bg focus:text-destructive"
            >
              <LogOut size={14} className="mr-2" aria-hidden />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}

export { SidebarNav }
export type { SidebarNavProps }
