import { semanaActual } from './semanaActual'

const SEMANAS_POR_MES = 4

/**
 * Computes the current treatment month (1-based) for a patient.
 *
 * Un mes de tratamiento son 4 semanas (28 días) contadas desde el arranque,
 * NUNCA un mes calendario (ADR 0011): las semanas de contenido 1–4 son el
 * mes 1, las 5–8 el mes 2, y así. Se deriva de `semanaActual` para que mes y
 * semana salgan de una sola fuente y no puedan desalinearse.
 *
 * - Returns `null` when there is no active stage.
 * - Base 1: at least month 1, even on the start day (floor at 1, never 0).
 * - Capped at `cantidadNiveles` (read from `modalidades.cantidad_niveles` — never hardcoded).
 *
 * NOTE: This is independent of `etapaOrdinal` — do not derive one from the other (DevSpec §9.3).
 */
const mesActual = (
  etapaActiva: { fechaInicio: string; cantidadNiveles: number } | null,
  hoy: Date,
): number | null => {
  if (etapaActiva === null) return null
  const semana = semanaActual(etapaActiva.fechaInicio, hoy)
  const mes = Math.max(1, Math.ceil(semana / SEMANAS_POR_MES))
  return Math.min(mes, etapaActiva.cantidadNiveles)
}

export { mesActual }
