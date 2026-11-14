import { monthsBetween } from './monthsBetween'

const computeEdad = (
  fechaNacimiento: string | null,
  today: Date = new Date(),
): number | null => {
  if (fechaNacimiento === null) return null
  // La edad en años son los meses completos / 12. Reusa monthsBetween (calendario
  // LOCAL, no UTC, por el desfase de UTC-3 cerca del cumpleaños) en vez de duplicar
  // la lógica day-of-month.
  return Math.floor(monthsBetween(fechaNacimiento, today) / 12)
}

export { computeEdad }
