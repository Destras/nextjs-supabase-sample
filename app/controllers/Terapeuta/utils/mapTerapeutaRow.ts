import { ROLE, resolveRole } from '@/app/controllers/Auth'
import type { Profile } from '@/app/controllers/Auth'
import type { Terapeuta } from '../TerapeutaTypes'
import { TERAPEUTA_STATE } from '../TerapeutaTypes'

interface TerapeutaRowRaw {
  id: string
  telefono: string | null
  estados_terapeuta: { codigo: string } | null
  profiles: {
    id: string
    nombre: string | null
    timezone: string | null
    roles: { codigo: string } | null
  } | null
}

const resolveState = (codigo: string | undefined): TERAPEUTA_STATE => {
  if (codigo === TERAPEUTA_STATE.PENDIENTE) return TERAPEUTA_STATE.PENDIENTE
  if (codigo === TERAPEUTA_STATE.ACTIVO) return TERAPEUTA_STATE.ACTIVO
  return TERAPEUTA_STATE.INACTIVO
}

const mapTerapeutaRow = (raw: TerapeutaRowRaw): Terapeuta | null => {
  if (!raw.profiles) {
    return null
  }

  const profile: Profile = {
    id: raw.profiles.id,
    name: raw.profiles.nombre ?? '',
    role: resolveRole(raw.profiles.roles?.codigo),
    timezone: raw.profiles.timezone ?? '',
    email: '',
  }

  return {
    id: raw.id,
    role: ROLE.TERAPEUTA,
    state: resolveState(raw.estados_terapeuta?.codigo),
    email: '',
    telefono: raw.telefono,
    pacientesActivos: 0,
    profile,
  }
}

export type { TerapeutaRowRaw }
export { mapTerapeutaRow }
