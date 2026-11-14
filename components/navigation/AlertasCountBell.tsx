'use client'

import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAlertasCountValue } from '@/components/alertas'
import { GuardedLink } from './GuardedLink'

// Campana global del shell: consume el count compartido de
// AlertasCountProvider (que envuelve useAlertasCount, 3.2) y linkea a
// /alertas. El badge solo se muestra con count > 0 y datos confiables — se
// oculta en loading y ante error del RPC (degradación silenciosa: el usuario
// sigue viendo la campana y puede navegar a /alertas para ver el detalle
// real, aunque el número no se pudo refrescar). Al marcar una alerta en el
// inbox, el count baja al instante (adjust optimista compartido) en vez de
// esperar al próximo fetch/focus/route-change.
const AlertasCountBell = () => {
  const { count, isLoading, error } = useAlertasCountValue()

  const showBadge = !isLoading && !error && count > 0

  return (
    <GuardedLink
      href="/alertas"
      aria-label={`Alertas activas: ${count}`}
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell size={18} aria-hidden />
      {showBadge && (
        <Badge
          variant="destructive"
          className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
        >
          {count}
        </Badge>
      )}
    </GuardedLink>
  )
}

export { AlertasCountBell }
