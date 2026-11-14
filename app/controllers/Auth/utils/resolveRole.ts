import { ROLE } from '../AuthTypes'

const resolveRole = (codigo: string | undefined): ROLE => {
  if (codigo === ROLE.ADMIN) return ROLE.ADMIN
  if (codigo === ROLE.TERAPEUTA) return ROLE.TERAPEUTA
  if (codigo === ROLE.PACIENTE) return ROLE.PACIENTE
  return ROLE.PACIENTE
}

export { resolveRole }
