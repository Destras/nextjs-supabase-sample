import type { Paciente } from '@/app/controllers/Paciente'

// true sii algún paciente tiene un score registrado. Gobierna los empty states
// Tier B (fuente=canal del paciente): día-1 todos los ultimoScore son null.
const hasEvaluaciones = (pacientes: ReadonlyArray<Paciente>): boolean =>
  pacientes.some((p) => p.ultimoScore != null)

export { hasEvaluaciones }
