import type { ReactNode } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Trend = 'up' | 'down' | 'flat'

const TREND_COLOR: Record<Trend, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
}

interface StatCardProps {
  readonly label: string
  readonly value: ReactNode | null
  readonly suffix?: string
  readonly delta?: string
  readonly trend?: Trend
  readonly featured?: boolean
  readonly emptyHint?: string
  readonly href?: string
  // Badge junto al label (mapea `.flag` / `.pill-end` de
  // dashboard-distribucion.html — ej. "⚑ mes 3", "terminan").
  readonly badge?: ReactNode
}

// Mapea el `.stat` del mock (pages-1.jsx · Dashboard). value==null → renderiza
// emptyHint (Tier B sin data), no la cifra. featured: en oscuro mantiene el
// gradiente brand-soft (que ahí se ve bien); en claro ese gradiente es oscuro
// fijo e ilegible, así que usa un tinte translúcido del primary. href opcional
// → la card es un link clickeable.
const StatCard = ({
  label,
  value,
  suffix,
  delta,
  trend = 'flat',
  featured = false,
  emptyHint,
  href,
  badge,
}: StatCardProps) => {
  const card = (
    <Card
      className={cn(
        'gap-0 p-5',
        featured &&
          'border-primary/40 bg-primary/5 dark:border-primary/30 dark:bg-gradient-brand-soft',
        href && 'transition-colors hover:border-primary/50 hover:bg-muted/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow text-muted-foreground">{label}</div>
        {badge}
      </div>
      {value == null ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-medium tracking-tight tabular-nums">
            {value}
          </span>
          {suffix && (
            <span className="text-sm text-muted-foreground">{suffix}</span>
          )}
        </div>
      )}
      {value != null && delta && (
        <div className={cn('mt-2 font-mono text-xs', TREND_COLOR[trend])}>
          {delta}
        </div>
      )}
    </Card>
  )

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  )
}

export { StatCard }
export type { StatCardProps, Trend }
