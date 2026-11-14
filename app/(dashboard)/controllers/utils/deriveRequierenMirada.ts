import type { Paciente } from '@/app/controllers/Paciente'
import type { PacienteFila } from '../dashboardTypes'

const REQUIEREN_MIRADA_LIMIT = 6

// T5 (Tier B): top pacientes que requieren atención. Se puebla desde las
// alertas reales (solo `score_bajo` — DEC-2, no desde `tieneAlerta`/score
// crudo): filtra a los pacientes con alguna alerta activa de ese tipo, ordena
// por score más bajo primero (null al final) y se queda con el top N. Vacío
// si no hay pacientes con alerta.
const deriveRequierenMirada = (
  pacientes: ReadonlyArray<Paciente>,
  alertaPacienteIds: ReadonlySet<string>,
): PacienteFila[] => {
  return pacientes
    .filter((p) => alertaPacienteIds.has(p.id))
    .sort((a, b) => (a.ultimoScore ?? Infinity) - (b.ultimoScore ?? Infinity))
    .slice(0, REQUIEREN_MIRADA_LIMIT)
}

export { deriveRequierenMirada, REQUIEREN_MIRADA_LIMIT }
