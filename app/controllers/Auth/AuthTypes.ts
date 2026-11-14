enum ROLE {
  ADMIN = 'admin',
  TERAPEUTA = 'terapeuta',
  // User can never be a paciente type inside this app. Leaving this for the record
  PACIENTE = 'paciente',
}

interface Profile {
  readonly id: string
  readonly name: string
  readonly role: ROLE
  readonly timezone: string
  readonly email: string
}

export type { Profile }
export { ROLE }
