import { randomBytes, randomInt } from 'node:crypto'

interface PatientSeed {
  readonly token: string
  readonly nombre: string
  readonly email: string
  readonly telefono: string
  readonly fechaNacimiento: string
}

/**
 * Generates a run-unique token, e.g. `E2E-a3f9c1`. Every row created by a
 * spec is tagged with this token (via `pacientes.nombre like '{token} %'`)
 * so cleanup can find and delete exactly its own subtree, never touching
 * seed data or other parallel runs.
 */
const newRunToken = (): string => `E2E-${randomBytes(4).toString('hex')}`

/**
 * Builds a fully unique `PatientSeed` for the intake wizard. Seed rows are
 * read-only — this never reuses or mutates them.
 */
const uniquePatient = (token: string = newRunToken()): PatientSeed => {
  const emailSuffix = randomBytes(3).toString('hex')
  // 10 numeric digits — E.164 regex is `^\+[1-9]\d{7,14}$`, so `+549` (first
  // digit 5) plus 10 more digits is well within the 7-14 digit range.
  const phoneDigits = Array.from({ length: 10 }, () => randomInt(0, 10)).join(
    '',
  )

  return {
    token,
    nombre: `${token} Paciente Prueba`,
    email: `${token.toLowerCase()}-${emailSuffix}@e2e.clienteapp.test`,
    telefono: `+549${phoneDigits}`,
    fechaNacimiento: '1990-05-15',
  }
}

export type { PatientSeed }
export { newRunToken, uniquePatient }
