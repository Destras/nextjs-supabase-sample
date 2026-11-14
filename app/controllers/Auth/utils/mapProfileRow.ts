import type { Profile } from '../AuthTypes'
import { resolveRole } from './resolveRole'

interface ProfileRowRaw {
  id: string
  nombre: string | null
  timezone: string | null
  roles: { codigo: string } | null
}

const mapProfileRow = (row: ProfileRowRaw, email: string): Profile => {
  return {
    id: row.id,
    name: row.nombre ?? '',
    role: resolveRole(row.roles?.codigo),
    timezone: row.timezone ?? '',
    email,
  }
}

export type { ProfileRowRaw }
export { mapProfileRow }
