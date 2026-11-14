import { attachPct } from '@/lib/distribution'
import type { AdminDashboardStats } from '../AdminDashboardTypes'

// Forma cruda del jsonb que devuelve get_admin_dashboard_stats(). El RPC ya
// resuelve los conteos server-side; el mapper solo computa el pct de cada
// distribución (no vive en SQL, es presentación) vía el helper compartido.
// El RPC (get_admin_dashboard_stats) puede seguir devolviendo en_mes_3 /
// fin_tratamiento en el jsonb — el mapper simplemente no los lee (fix
// producto: las cards que los mostraban eran redundantes con
// distribucionMes). No tocar el RPC es deliberado (front-end-only fix).
interface AdminDashboardStatsRaw {
  totales: {
    pacientes_activos: number
    nuevos_mes: number
    alertas_activas: number | null
    score_promedio: number | null
  }
  distribucionEtapa: ReadonlyArray<{ label: string; cantidad: number }>
  distribucionMes: ReadonlyArray<{ label: string; cantidad: number }>
}

const mapAdminDashboardStats = (
  raw: AdminDashboardStatsRaw,
): AdminDashboardStats => ({
  pacientesActivos: raw.totales.pacientes_activos,
  nuevosEsteMes: raw.totales.nuevos_mes,
  alertasTotales: raw.totales.alertas_activas,
  scorePromedio: raw.totales.score_promedio,
  distribucionEtapa: attachPct(raw.distribucionEtapa),
  distribucionMes: attachPct(raw.distribucionMes),
})

export type { AdminDashboardStatsRaw }
export { mapAdminDashboardStats }
