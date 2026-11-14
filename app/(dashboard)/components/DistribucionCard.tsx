import type { ReactNode } from 'react'
import type { DistItem } from '../controllers/dashboardTypes'
import { DashboardCard } from './DashboardCard'
import { DistributionBars } from './DistributionBars'

interface DistribucionCardProps {
  readonly kicker?: string
  readonly kickerClassName?: string
  readonly title: string
  readonly description?: ReactNode
  readonly items: ReadonlyArray<DistItem>
}

// Card de distribución (Tier A): la sustancia descriptiva del dashboard día-1.
// Reusada por etapa (T7), por mes de tratamiento (hoy) y por la proyección de
// mes siguiente (C.1.3/C.2.2) — misma estructura, distinto título/dataset.
// `kickerClassName` pasa directo a DashboardCard: la card de proyección lo
// usa para el kicker dorado. `description` (DEC-5) pasa igual — solo la card
// de "por mes" actual la usa.
const DistribucionCard = ({
  kicker,
  kickerClassName,
  title,
  description,
  items,
}: DistribucionCardProps) => {
  return (
    <DashboardCard
      kicker={kicker}
      kickerClassName={kickerClassName}
      title={title}
      description={description}
    >
      <DistributionBars items={items} />
    </DashboardCard>
  )
}

export { DistribucionCard }
export type { DistribucionCardProps }
