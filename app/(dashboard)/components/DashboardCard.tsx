import type { ReactNode } from 'react'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DashboardCardProps {
  readonly kicker?: string
  readonly kickerClassName?: string
  readonly title?: ReactNode
  readonly description?: ReactNode
  readonly action?: ReactNode
  readonly children: ReactNode
}

// Mapea el `.card` + `.card-head` del mock: kicker (eyebrow) + title a la
// izquierda, action a la derecha (slot CardAction de shadcn). `kickerClassName`
// permite variantes de color del kicker (ej. `.kicker.is-gold` del mock de
// proyección) sin tocar el átomo. `description` (DEC-5) es una caption muted
// debajo del title — no viene del mock de esta card, se agrega aditivamente
// para explicar la card "por mes" sin tocar los call sites que no la pasan.
const DashboardCard = ({
  kicker,
  kickerClassName,
  title,
  description,
  action,
  children,
}: DashboardCardProps) => {
  return (
    <Card>
      {(kicker || title || action) && (
        <CardHeader>
          {kicker && (
            <CardDescription className={cn('eyebrow', kickerClassName)}>
              {kicker}
            </CardDescription>
          )}
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export { DashboardCard }
export type { DashboardCardProps }
