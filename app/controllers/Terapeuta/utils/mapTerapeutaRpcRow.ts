import { ROLE } from '@/app/controllers/Auth'
import type { Profile } from '@/app/controllers/Auth'
import type { Terapeuta } from '../TerapeutaTypes'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

interface TerapeutaRpcRow {
  id: string
  nombre: string
  email: string
  telefono: string | null
  estado: string // 'pendiente' | 'activo' | 'inactivo'
  pacientes_activos: number
  // Solo list_terapeutas la expone (task 2.1) — get_terapeuta/update_terapeuta
  // todavía no. Opcional para que el mapper sirva a las 3 RPCs.
  alertas_activas?: number
  // DEC-12: solo list_terapeutas la expone — mismo patrón que alertas_activas.
  sin_iniciar?: number
}

const resolveEstado = (estado: string): TERAPEUTA_STATE => {
  if (estado === TERAPEUTA_STATE.PENDIENTE) return TERAPEUTA_STATE.PENDIENTE
  if (estado === TERAPEUTA_STATE.ACTIVO) return TERAPEUTA_STATE.ACTIVO
  if (estado === TERAPEUTA_STATE.INACTIVO) return TERAPEUTA_STATE.INACTIVO
  return TERAPEUTA_STATE.INACTIVO
}

const mapTerapeutaRpcRow = (row: TerapeutaRpcRow): Terapeuta => {
  const profile: Profile = {
    id: row.id,
    name: row.nombre,
    email: row.email,
    role: ROLE.TERAPEUTA,
    timezone: '',
  }

  return {
    id: row.id,
    profile,
    role: ROLE.TERAPEUTA,
    state: resolveEstado(row.estado),
    email: row.email,
    telefono: row.telefono,
    pacientesActivos: row.pacientes_activos,
    alertasActivas: row.alertas_activas,
    sinIniciar: row.sin_iniciar,
  }
}

export type { TerapeutaRpcRow }
export { mapTerapeutaRpcRow }
