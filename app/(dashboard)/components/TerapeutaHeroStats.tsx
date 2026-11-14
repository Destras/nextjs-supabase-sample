import { StatCard } from './StatCard'
import type { HeroStats } from '../controllers/dashboardTypes'

interface TerapeutaHeroStatsProps {
  readonly stats: HeroStats
}

// Heroes reclasificados (DevSpec §16.3): T1 Activos (A, featured), T2 Nuevos
// este mes (A), Score promedio (B, empty state cuando scorePromedio es null).
// "Con alerta" se saca del hero: la campana global ya cubre ese número con
// los 4 tipos reales de alerta.
const TerapeutaHeroStats = ({ stats }: TerapeutaHeroStatsProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      <StatCard label="Pacientes activos" value={stats.activos} featured />
      <StatCard label="Nuevos este mes" value={stats.nuevosEsteMes} />
      <StatCard
        label="Score promedio"
        value={stats.scorePromedio}
        suffix="/5"
        emptyHint="Sin evaluaciones aún"
      />
    </div>
  )
}

export { TerapeutaHeroStats }
export type { TerapeutaHeroStatsProps }
