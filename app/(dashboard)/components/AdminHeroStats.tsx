import { StatCard } from './StatCard'
import type { AdminDashboardViewModel } from '../controllers'

interface AdminHeroStatsProps {
  readonly stats: AdminDashboardViewModel['stats']
}

// grid-4 del mock (variante admin). A1 Pacientes activos (featured, delta de
// nuevos del mes) · A2 Terapeutas activos · A3 Invitaciones pendientes · A4
// Alertas totales (Tier B, empty state si null).
const AdminHeroStats = ({ stats }: AdminHeroStatsProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
      <StatCard
        label="Pacientes activos"
        value={stats.pacientesActivos}
        featured
        trend="up"
        delta={
          stats.nuevosEsteMes > 0
            ? `+${stats.nuevosEsteMes} este mes`
            : undefined
        }
      />
      <StatCard label="Terapeutas activos" value={stats.terapeutasActivos} />
      <StatCard
        label="Invitaciones pendientes"
        value={stats.invitacionesPendientes}
      />
      <StatCard
        label="Alertas totales"
        value={stats.alertasTotales}
        trend="down"
        emptyHint="Sin evaluaciones aún"
      />
    </div>
  )
}

export { AdminHeroStats }
export type { AdminHeroStatsProps }
