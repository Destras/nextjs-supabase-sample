import type { TerapeutaRollup } from '../TerapeutaTypes'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

// Fila cruda de list_terapeutas() (extendida con score_promedio y
// alertas_activas) para el dashboard admin. Mapper SEPARADO del de Terapeuta:
// este sí lee las columnas nuevas; el viejo (mapTerapeutaRpcRow) las ignora.
interface TerapeutaDashboardRow {
  id: string
  nombre: string
  email: string
  telefono: string | null
  estado: string
  pacientes_activos: number
  score_promedio: number | null
  alertas_activas: number | null
}

const resolveEstado = (estado: string): TERAPEUTA_STATE => {
  if (estado === TERAPEUTA_STATE.PENDIENTE) return TERAPEUTA_STATE.PENDIENTE
  if (estado === TERAPEUTA_STATE.ACTIVO) return TERAPEUTA_STATE.ACTIVO
  if (estado === TERAPEUTA_STATE.INACTIVO) return TERAPEUTA_STATE.INACTIVO
  return TERAPEUTA_STATE.INACTIVO
}

const mapTerapeutaDashboardRow = (
  row: TerapeutaDashboardRow,
): TerapeutaRollup => ({
  id: row.id,
  nombre: row.nombre,
  estado: resolveEstado(row.estado),
  pacientesActivos: row.pacientes_activos,
  scorePromedio:
    row.score_promedio === null
      ? null
      : Math.round(row.score_promedio * 10) / 10,
  alertasActivas: row.alertas_activas,
})

export type { TerapeutaDashboardRow }
export { mapTerapeutaDashboardRow }
